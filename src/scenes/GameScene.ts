import Phaser from 'phaser';
import { Engine, type Dir, type Tile, type MoveResult } from '../game/Engine';
import {
  W,
  DESIGN_H,
  TEX,
  BOARD_X,
  BOARD_Y,
  PAD,
  CELL,
  GAP,
  ORB_SCALE,
  orbKey,
  orbStyle,
  orbColorInt,
  DPR,
} from '../game/Textures';
import {
  FONT,
  goldText,
  stoneText,
  makeButton,
  makeIconButton,
  img,
  setupCamera,
  addBackground,
  addDim,
  addTorch,
  addFireflies,
  type Button,
} from '../game/UI';
import { sfx } from '../game/Audio';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../game/Native';
import { loadSave, writeSave, loadBest, writeBest } from '../game/Storage';
import { rating } from '../game/Rating';

const SLIDE_MS = 110;
const SWIPE_MIN = 28;
const FROG_SCALE = 0.78 * TEX;

type OrbSprite = Phaser.GameObjects.Container & { value: number };

export class GameScene extends Phaser.Scene {
  private engine!: Engine;
  private sprites = new Map<number, OrbSprite>();
  private tileLayer!: Phaser.GameObjects.Container;
  private busy = false;
  private wonShown = false;
  private over = false;
  /** an overlay (win / game over / rate) is open */
  private overlayOpen = false;

  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private frog!: Phaser.GameObjects.Image;
  private lids!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Image;
  private undoBtn!: Button;
  private soundBtn!: Button;

  private swipeStart: { x: number; y: number } | null = null;
  private swipeUsed = false;

  constructor() {
    super('Game');
  }

  init(data: { fresh?: boolean }): void {
    this.engine = new Engine();
    this.engine.best = loadBest();
    this.wonShown = false;
    this.over = false;
    this.busy = false;
    this.sprites.clear();
    if (!data?.fresh) {
      const save = loadSave();
      if (save) {
        this.engine.load(save);
        this.engine.best = Math.max(this.engine.best, save.best);
        this.wonShown = save.won;
      }
    }
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    addBackground(this);

    // title on a carved stone lintel, flanked by torches
    img(this, W / 2, 66, 'title-plaque');
    goldText(this, W / 2, 66, 'TEMPLE 2048', 58, 8);
    addTorch(this, 46, 40);
    addTorch(this, W - 46, 40);

    // frog idol + score plaques
    this.frog = img(this, W / 2, 432, 'frog').setOrigin(0.5, 1).setScale(FROG_SCALE);
    this.lids = img(this, W / 2, 432, 'frog-lids').setOrigin(0.5, 1).setScale(FROG_SCALE).setVisible(false);
    this.tweens.add({
      targets: [this.frog, this.lids],
      scaleY: FROG_SCALE * 0.975,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const blink = () => {
      if (!this.scene.isActive()) return;
      this.lids.setVisible(true);
      this.time.delayedCall(120, () => this.lids.setVisible(false));
      this.time.delayedCall(2500 + Math.random() * 3000, blink);
    };
    this.time.delayedCall(2000, blink);

    img(this, 128, 300, 'plaque');
    stoneText(this, 128, 272, 'SCORE', 22, '#d9cf9a');
    this.scoreText = stoneText(this, 128, 316, '0', 40);
    img(this, W - 128, 300, 'plaque');
    stoneText(this, W - 128, 272, 'BEST', 22, '#d9cf9a');
    this.bestText = stoneText(this, W - 128, 316, '0', 40);

    // board
    this.board = img(this, BOARD_X, BOARD_Y, 'board').setOrigin(0);
    this.tileLayer = this.add.container(0, 0);

    addFireflies(this);

    // buttons
    this.undoBtn = makeIconButton(this, 95, 1172, 'icon-undo', 'button-sm', () => this.undo());
    makeButton(this, W / 2, 1172, 'NEW GAME', 'button', () => this.newGame(), 30);
    this.soundBtn = makeIconButton(this, W - 95, 1172, sfx.muted ? 'icon-sound-off' : 'icon-sound-on', 'button-sm', () =>
      this.toggleSound(),
    );

    for (const t of this.engine.tiles()) this.addSprite(t, false);
    this.refreshHud();

    // input (world coordinates so the camera zoom does not matter)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      this.swipeStart = { x: p.worldX, y: p.worldY };
      this.swipeUsed = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || this.swipeUsed || !p.isDown) return;
      const dx = p.worldX - this.swipeStart.x;
      const dy = p.worldY - this.swipeStart.y;
      if (Math.hypot(dx, dy) < SWIPE_MIN * 1.6) return;
      this.swipeUsed = true;
      this.handleSwipe(dx, dy);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || this.swipeUsed) {
        this.swipeStart = null;
        return;
      }
      const dx = p.worldX - this.swipeStart.x;
      const dy = p.worldY - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.hypot(dx, dy) >= SWIPE_MIN) this.handleSwipe(dx, dy);
    });

    // count real play time (tab visible, no overlay) for the rating prompt
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (document.hidden || this.overlayOpen) return;
        rating.tick(1);
      },
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        this.tryMove(dir);
      }
    });
  }

  // ---------- layout helpers ----------
  private cellX(c: number): number {
    return BOARD_X + PAD + CELL / 2 + c * (CELL + GAP);
  }
  private cellY(r: number): number {
    return BOARD_Y + PAD + CELL / 2 + r * (CELL + GAP);
  }

  private fontSizeFor(value: number): number {
    const d = String(value).length;
    return d <= 1 ? 64 : d === 2 ? 60 : d === 3 ? 50 : d === 4 ? 42 : 34;
  }

  private addSprite(t: Tile, pop: boolean): OrbSprite {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (t.value >= 512) {
      // sacred orbs glow
      const glow = this.add.image(0, 0, 'glow').setTint(orbColorInt(t.value)).setAlpha(0.55).setScale(0.75 * TEX);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.25, scale: 0.6 * TEX, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      parts.push(glow);
    }
    const image = this.add.image(0, 0, orbKey(t.value)).setScale(ORB_SCALE);
    const style = orbStyle(t.value);
    const txt = this.add
      .text(0, 2, String(t.value), {
        fontFamily: FONT,
        fontSize: `${this.fontSizeFor(t.value)}px`,
        fontStyle: 'bold',
        color: style.text,
        stroke: style.text === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.35)',
        strokeThickness: 5,
        resolution: DPR,
      })
      .setOrigin(0.5);
    txt.setShadow(0, 3, 'rgba(0,0,0,0.45)', 4, false, true);
    parts.push(image, txt);
    const c = this.add.container(this.cellX(t.c), this.cellY(t.r), parts) as OrbSprite;
    c.value = t.value;
    this.tileLayer.add(c);
    this.sprites.set(t.id, c);
    if (pop) {
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, duration: 170, ease: 'Back.easeOut' });
    }
    return c;
  }

  // ---------- input ----------
  private handleSwipe(dx: number, dy: number): void {
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.tryMove(dir);
  }

  private tryMove(dir: Dir): void {
    if (this.busy || this.over) return;
    const result = this.engine.move(dir);
    if (!result.moved) {
      this.nudge(dir);
      return;
    }
    this.busy = true;
    this.animate(result);
  }

  private nudge(dir: Dir): void {
    if (this.tweens.isTweening(this.board)) return;
    const dx = dir === 'left' ? -8 : dir === 'right' ? 8 : 0;
    const dy = dir === 'up' ? -8 : dir === 'down' ? 8 : 0;
    this.tweens.add({
      targets: [this.board, this.tileLayer],
      x: `+=${dx}`,
      y: `+=${dy}`,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  // ---------- animation ----------
  private animate(result: MoveResult): void {
    sfx.slide();
    void hapticLight();

    for (const m of result.moves) {
      const s = this.sprites.get(m.id);
      if (!s) continue;
      if (m.fromR === m.toR && m.fromC === m.toC) continue;
      this.tweens.add({
        targets: s,
        x: this.cellX(m.toC),
        y: this.cellY(m.toR),
        duration: SLIDE_MS,
        ease: 'Quad.easeOut',
      });
    }

    this.time.delayedCall(SLIDE_MS, () => {
      let biggest = 0;
      result.merges.forEach((mg, i) => {
        for (const id of mg.fromIds) {
          const s = this.sprites.get(id);
          if (s) {
            this.sprites.delete(id);
            s.destroy();
          }
        }
        const s = this.addSprite(mg.tile, false);
        s.setScale(0.6);
        this.tweens.add({ targets: s, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.burst(this.cellX(mg.tile.c), this.cellY(mg.tile.r), mg.tile.value, i);
        this.floatScore(this.cellX(mg.tile.c), this.cellY(mg.tile.r) - 40, mg.tile.value);
        sfx.pop(mg.tile.value, i);
        biggest = Math.max(biggest, mg.tile.value);
      });

      if (result.merges.length >= 2) this.combo(result.merges.length);
      if (result.merges.length > 0) {
        void hapticMedium();
        this.frogReact();
      }
      if (biggest >= 128) this.cameras.main.shake(140, Math.min(0.006, 0.0015 * Math.log2(biggest / 64)));

      if (result.spawned) this.addSprite(result.spawned, true);

      this.refreshHud();
      this.persist();
      this.busy = false;

      if (this.engine.won && !this.wonShown) {
        this.wonShown = true;
        this.persist();
        this.time.delayedCall(350, () => this.showOverlay(true));
      } else if (this.engine.isGameOver()) {
        this.time.delayedCall(400, () => this.showOverlay(false));
      } else if (rating.shouldPrompt()) {
        this.time.delayedCall(450, () => this.showRatePrompt());
      }
    });
  }

  private burst(x: number, y: number, value: number, index: number): void {
    const tint = orbColorInt(value);
    const emitter = this.add.particles(x, y, 'spark', {
      speed: { min: 140, max: 440 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0 * TEX, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 320, max: 640 },
      gravityY: 600,
      tint: [tint, 0xffffff, tint],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(50);
    this.time.delayedCall(index * 45, () => {
      emitter.explode(26);
      const ring = this.add.image(x, y, 'ring').setTint(tint).setScale(0.3 * TEX).setAlpha(0.9).setDepth(49);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ring,
        scale: 1.7 * TEX,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
      const flash = this.add.image(x, y, 'glow').setTint(tint).setScale(0.5 * TEX).setAlpha(0.8).setDepth(48);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, scale: 1.1 * TEX, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    });
    this.time.delayedCall(1000, () => emitter.destroy());
  }

  private floatScore(x: number, y: number, n: number): void {
    const t = stoneText(this, x, y, `+${n}`, 36, '#fff3b0').setDepth(60);
    this.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private combo(n: number): void {
    sfx.combo(n);
    const t = goldText(this, W / 2, 232, `COMBO x${n}!`, 54, 8).setDepth(70).setScale(0.4);
    this.tweens.add({
      targets: t,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: t, y: 182, alpha: 0, duration: 500, delay: 250, onComplete: () => t.destroy() });
      },
    });
  }

  private frogReact(): void {
    this.tweens.add({
      targets: [this.frog, this.lids],
      scaleY: FROG_SCALE * 0.86,
      scaleX: FROG_SCALE * 1.1,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  // ---------- hud & state ----------
  private refreshHud(): void {
    this.scoreText.setText(String(this.engine.score));
    this.bestText.setText(String(this.engine.best));
    this.undoBtn.setEnabled(this.engine.canUndo() && !this.over);
  }

  private persist(): void {
    writeBest(this.engine.best);
    writeSave(this.engine.save());
  }

  private undo(): void {
    if (this.busy || this.over || !this.engine.undo()) return;
    this.rebuildBoard();
    this.refreshHud();
    this.persist();
  }

  private rebuildBoard(): void {
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    for (const t of this.engine.tiles()) this.addSprite(t, true);
  }

  private newGame(): void {
    if (this.busy) return;
    this.engine.reset();
    this.over = false;
    this.wonShown = false;
    this.rebuildBoard();
    this.refreshHud();
    this.persist();
  }

  private toggleSound(): void {
    const muted = sfx.toggle();
    this.soundBtn.icon?.setTexture(muted ? 'icon-sound-off' : 'icon-sound-on');
  }

  // ---------- overlays ----------
  private showOverlay(won: boolean): void {
    this.over = true;
    this.overlayOpen = true;
    this.refreshHud();
    if (won) {
      sfx.win();
      void hapticSuccess();
    } else {
      sfx.lose();
      void hapticError();
    }

    const dim = addDim(this);
    const panel = img(this, W / 2, DESIGN_H / 2, 'panel');
    const title = goldText(this, W / 2, DESIGN_H / 2 - 170, won ? 'SACRED GEM!' : 'GAME OVER', won ? 62 : 66, 9);
    const sub = stoneText(this, W / 2, DESIGN_H / 2 - 95, won ? 'You forged the 2048 gem' : 'The temple is full', 28, '#d9cf9a');
    const score = stoneText(this, W / 2, DESIGN_H / 2 - 20, `SCORE  ${this.engine.score}`, 44);
    const best = stoneText(this, W / 2, DESIGN_H / 2 + 40, `BEST  ${this.engine.best}`, 30, '#ffe9a8');

    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title, sub, score, best];
    const close = () => {
      items.forEach((o) => o.destroy());
      this.overlayOpen = false;
    };

    if (won) {
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 125, 'KEEP GOING', 'button', () => {
          close();
          this.over = false;
          this.refreshHud();
        }, 30),
      );
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 220, 'NEW GAME', 'button', () => {
          close();
          this.newGame();
        }, 30),
      );
      // celebratory burst of orbs
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => this.burst(140 + Math.random() * 440, 500 + Math.random() * 500, [256, 512, 1024, 2048][i % 4], 0));
    } else {
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 135, 'TRY AGAIN', 'button', () => {
          close();
          this.newGame();
        }, 32),
      );
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 225, 'MENU', 'button', () => {
          close();
          this.scene.start('Menu');
        }, 30),
      );
    }

    for (const o of items) {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(100);
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    }
    this.tweens.add({ targets: items, alpha: 1, duration: 300 });
    panel.setScale(0.8 * TEX);
    this.tweens.add({ targets: panel, scale: TEX, duration: 320, ease: 'Back.easeOut' });

    if (!won) writeSave(null);
  }

  // ---------- rate us ----------
  private showRatePrompt(): void {
    if (this.overlayOpen || this.over) return;
    this.overlayOpen = true;
    rating.markShown();

    const dim = addDim(this, 0.6);
    const panel = img(this, W / 2, DESIGN_H / 2, 'panel');
    const title = goldText(this, W / 2, DESIGN_H / 2 - 175, 'ENJOYING IT?', 58, 9);
    const stars = goldText(this, W / 2, DESIGN_H / 2 - 95, '★ ★ ★ ★ ★', 52, 6);
    const sub = stoneText(this, W / 2, DESIGN_H / 2 - 25, 'A quick rating helps the temple grow', 26, '#d9cf9a');

    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title, stars, sub];
    const close = () => {
      items.forEach((o) => o.destroy());
      this.overlayOpen = false;
    };

    items.push(
      makeButton(this, W / 2, DESIGN_H / 2 + 60, 'RATE US', 'button', () => {
        rating.rated();
        close();
        void rating.openStore();
      }, 32),
    );
    items.push(
      makeButton(this, W / 2, DESIGN_H / 2 + 150, 'LATER', 'button', () => {
        rating.later();
        close();
      }, 28),
    );
    const no = stoneText(this, W / 2, DESIGN_H / 2 + 225, 'No thanks', 24, '#b9b39a').setInteractive({ useHandCursor: true });
    no.on('pointerup', () => {
      rating.never();
      close();
    });
    items.push(no);

    for (const o of items) {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(100);
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    }
    this.tweens.add({ targets: items, alpha: 1, duration: 300 });
    panel.setScale(0.8 * TEX);
    this.tweens.add({ targets: panel, scale: TEX, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: stars, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
