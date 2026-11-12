import Phaser from 'phaser';
import { Engine, seededRandom, type Dir, type Tile, type MoveResult, type SaveState } from '../game/Engine';
import {
  W,
  DESIGN_H,
  TEX,
  BOARD,
  BOARD_X,
  BOARD_Y,
  boardGeom,
  boardKey,
  orbKey,
  orbStyle,
  orbColorInt,
  DPR,
  type BoardGeom,
} from '../game/Textures';
import {
  FONT,
  goldText,
  stoneText,
  makeButton,
  makeIconButton,
  addBadge,
  img,
  setupCamera,
  addBackground,
  addDim,
  addFireflies,
  type Button,
} from '../game/UI';
import { sfx } from '../game/Audio';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../game/Native';
import { progress, loadSave, writeSave, dayKey } from '../game/Progress';
import { MODES, type Mode, type ModeId } from '../game/Modes';
import { dailyGoals, daySeed, evalGoals, type Goal, type GoalProgress } from '../game/Daily';
import { shareText, scoreShareText } from '../game/Share';
import { rating } from '../game/Rating';

const SLIDE_MS = 110;
const SWIPE_MIN = 28;
const FROG_SCALE = 0.78 * TEX;
const ANNOUNCE_Y = 232;

type OrbSprite = Phaser.GameObjects.Container & { value: number };

export interface GameStart {
  mode?: ModeId;
  fresh?: boolean;
}

export class GameScene extends Phaser.Scene {
  private mode!: Mode;
  private geom!: BoardGeom;
  private engine!: Engine;
  private sprites = new Map<number, OrbSprite>();
  private tileLayer!: Phaser.GameObjects.Container;
  private busy = false;
  private wonShown = false;
  private over = false;
  /** an overlay (win / game over / rate / tutorial) is open */
  private overlayOpen = false;
  private counted = false;

  private scoreText!: Phaser.GameObjects.Text;
  private rightText!: Phaser.GameObjects.Text;
  private frog!: Phaser.GameObjects.Image;
  private lids!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private undoBtn!: Button;
  private hammerBtn!: Button;
  private shuffleBtn!: Button;
  private soundBtn!: Button;
  private setUndoBadge!: (n: number) => void;
  private setHammerBadge!: (n: number) => void;
  private setShuffleBadge!: (n: number) => void;

  private swipeStart: { x: number; y: number } | null = null;
  private swipeUsed = false;

  // boosters
  private aiming = false;
  private aimToggledNow = false;
  private aimHint: Phaser.GameObjects.Text | null = null;

  // timed mode
  private timeLeft = 0;
  private timerStarted = false;

  // daily mode
  private goals: Goal[] = [];
  private goalDone: boolean[] = [];
  private goalProgress: GoalProgress = { maxTile: 0, score: 0, bestCombo: 0, boostersUsed: false };
  private goalTexts: Phaser.GameObjects.Text[] = [];
  private goalStars: Phaser.GameObjects.Image[] = [];

  // announcements (combo, streak, goals, unlocks) queue at the top of the board
  private announceQueue: { text: string; color?: string }[] = [];
  private announcing = false;

  private danger = false;
  private dangerTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameStart): void {
    this.mode = MODES[data?.mode ?? 'classic'];
    this.geom = boardGeom(this.mode.size);
    const rng = this.mode.id === 'daily' ? seededRandom(daySeed()) : Math.random;
    this.engine = new Engine(rng, this.mode.size, this.mode.winValue, this.mode.boosters);
    this.engine.best = progress.bestFor(this.mode.id);
    this.wonShown = false;
    this.over = false;
    this.busy = false;
    this.aiming = false;
    this.aimHint = null;
    this.overlayOpen = false;
    this.danger = false;
    this.dangerTimer = null;
    this.counted = false;
    this.timerStarted = false;
    this.timeLeft = this.mode.timeLimit ?? 0;
    this.sprites.clear();
    this.announceQueue = [];
    this.announcing = false;
    this.goalTexts = [];
    this.goalStars = [];
    this.goalProgress = { maxTile: 0, score: 0, bestCombo: 0, boostersUsed: false };

    if (this.mode.id === 'daily') {
      this.goals = dailyGoals();
      this.goalDone = this.goals.map(() => false);
    }

    let resumed = false;
    if (!data?.fresh && this.mode.resumable) {
      const save = loadSave(this.mode.id, this.mode.size);
      if (save && (this.mode.id !== 'daily' || save.dayKey === dayKey())) {
        this.engine.load(save);
        this.engine.best = Math.max(this.engine.best, save.best);
        this.wonShown = save.won;
        this.counted = save.counted ?? true;
        this.goalProgress.bestCombo = save.bestCombo ?? 0;
        this.goalProgress.boostersUsed = save.boostersUsed ?? false;
        resumed = true;
      }
    }
    if (!resumed && this.mode.id === 'daily') {
      // a fresh daily game must start from the seeded board: reset re-runs the two spawns
      this.engine = new Engine(seededRandom(daySeed()), 4, this.mode.winValue, this.mode.boosters);
      this.engine.best = progress.bestFor('daily');
    }
    this.refreshGoalProgress();
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    addBackground(this);

    // title plaque (narrowed so the corner buttons fit), home + sound buttons
    img(this, W / 2, 66, 'title-plaque').setScale(TEX * 0.76, TEX);
    goldText(this, W / 2, 66, this.mode.name, this.mode.name.length > 11 ? 42 : 52, 7);
    makeIconButton(this, 58, 66, 'icon-home', 'button-sm', () => this.goHome());
    this.soundBtn = makeIconButton(this, W - 58, 66, sfx.muted ? 'icon-sound-off' : 'icon-sound-on', 'button-sm', () =>
      this.toggleSound(),
    );

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
    const rightLabel = this.mode.timeLimit ? 'TIME' : this.mode.id === 'daily' ? 'GOALS' : 'BEST';
    stoneText(this, W - 128, 272, rightLabel, 22, '#d9cf9a');
    this.rightText = stoneText(this, W - 128, 316, '0', 40);

    // board
    this.board = img(this, BOARD_X, BOARD_Y, boardKey(this.mode.size)).setOrigin(0);
    this.tileLayer = this.add.container(0, 0);

    addFireflies(this);

    // danger vignette (hidden until the board is nearly full)
    this.vignette = img(this, W / 2, DESIGN_H / 2, 'vignette').setAlpha(0).setDepth(45);

    // daily goals strip
    const hasStrip = this.mode.id === 'daily';
    const btnY = hasStrip ? 1222 : 1172;
    if (hasStrip) this.buildGoalStrip(1134);

    // buttons
    this.undoBtn = makeIconButton(this, 80, btnY, 'icon-undo', 'button-sm', () => this.undo());
    this.setUndoBadge = addBadge(this, this.undoBtn, this.engine.undos);
    this.hammerBtn = makeIconButton(this, 200, btnY, 'icon-hammer', 'button-sm', () => this.toggleAim());
    this.setHammerBadge = addBadge(this, this.hammerBtn, this.engine.hammers);
    this.shuffleBtn = makeIconButton(this, 320, btnY, 'icon-shuffle', 'button-sm', () => this.shuffle());
    this.setShuffleBadge = addBadge(this, this.shuffleBtn, this.engine.shuffles);
    if (this.mode.boosters.shuffles === 0) this.shuffleBtn.setVisible(false);
    makeButton(this, 530, btnY, this.mode.id === 'daily' ? 'RESTART' : 'NEW GAME', 'button', () => this.newGame(), 30);

    for (const t of this.engine.tiles()) this.addSprite(t, false);
    this.refreshHud();

    // input (world coordinates so the camera zoom does not matter)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      this.swipeStart = { x: p.worldX, y: p.worldY };
      this.swipeUsed = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || this.swipeUsed || !p.isDown || this.aiming) return;
      const dx = p.worldX - this.swipeStart.x;
      const dy = p.worldY - this.swipeStart.y;
      if (Math.hypot(dx, dy) < SWIPE_MIN * 1.6) return;
      this.swipeUsed = true;
      this.handleSwipe(dx, dy);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.aimToggledNow) {
        this.aimToggledNow = false;
        this.swipeStart = null;
        return;
      }
      if (this.aiming) {
        this.swipeStart = null;
        this.aimTap(p.worldX, p.worldY);
        return;
      }
      if (!this.swipeStart || this.swipeUsed) {
        this.swipeStart = null;
        return;
      }
      const dx = p.worldX - this.swipeStart.x;
      const dy = p.worldY - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.hypot(dx, dy) >= SWIPE_MIN) this.handleSwipe(dx, dy);
    });

    // one-second clock: play time (rating + stats), the time-attack countdown, autosave
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (document.hidden || this.overlayOpen || this.over) return;
        rating.tick(1);
        progress.tickPlay(1);
        if (this.mode.timeLimit && this.timerStarted) this.tickTimer();
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

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => progress.flush());

    if (!progress.data.tutorialDone && this.mode.id === 'classic') this.time.delayedCall(400, () => this.showTutorial());
    else if (this.mode.id === 'daily' && this.engine.moveCount === 0) this.time.delayedCall(350, () => this.showDailyIntro());
    else if (this.mode.timeLimit && !this.timerStarted) this.announce('SWIPE TO START THE CLOCK', '#d9cf9a');
  }

  // ---------- layout helpers ----------
  private cellX(c: number): number {
    return this.geom.cellX(c);
  }
  private cellY(r: number): number {
    return this.geom.cellY(r);
  }

  private fontSizeFor(value: number): number {
    const d = String(value).length;
    const base = d <= 1 ? 64 : d === 2 ? 60 : d === 3 ? 50 : d === 4 ? 42 : 34;
    return Math.round(base * this.geom.fontScale);
  }

  private addSprite(t: Tile, pop: boolean): OrbSprite {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const glowScale = this.geom.fontScale;
    if (t.value >= 512) {
      // sacred orbs glow
      const glow = this.add.image(0, 0, 'glow').setTint(orbColorInt(t.value)).setAlpha(0.55).setScale(0.75 * TEX * glowScale);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.25, scale: 0.6 * TEX * glowScale, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      parts.push(glow);
    }
    const image = this.add.image(0, 0, orbKey(t.value)).setScale(this.geom.orbScale);
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
    if (this.busy || this.over || this.overlayOpen || this.aiming) return;
    const result = this.engine.move(dir);
    if (!result.moved) {
      this.nudge(dir);
      return;
    }
    this.busy = true;
    if (!this.counted) {
      this.counted = true;
      progress.recordGameStart();
    }
    if (this.mode.timeLimit && !this.timerStarted) {
      this.timerStarted = true;
      this.refreshHud();
    }
    if (progress.touchDay() && progress.data.streak >= 2) {
      this.announce(`DAY ${progress.data.streak} STREAK!`, '#ffb347');
    }
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

      // stats, unlocks, goals
      const newly = progress.recordMove(result.merges.length, result.merges.map((m) => m.tile.value));
      for (const v of newly) if (v >= 128) this.announce(`NEW GEM FORGED: ${v}`, '#8ff0c0');
      if (newly.some((v) => v >= 128)) sfx.chime();
      this.goalProgress.bestCombo = Math.max(this.goalProgress.bestCombo, result.merges.length);
      this.refreshGoalProgress();
      this.checkGoals();

      progress.setBest(this.mode.id, this.engine.best);
      this.refreshHud();
      this.persist();
      this.updateDanger();
      this.busy = false;

      if (this.engine.won && !this.wonShown) {
        this.wonShown = true;
        progress.recordGameEnd(this.engine.score, true);
        this.persist();
        this.time.delayedCall(350, () => this.showOverlay(true));
      } else if (this.engine.isGameOver()) {
        if (this.mode.zen) this.time.delayedCall(300, () => this.zenRelief());
        else this.time.delayedCall(400, () => this.showOverlay(false));
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
    const t = stoneText(this, x, y, `+${n}`, Math.round(36 * this.geom.fontScale), '#fff3b0').setDepth(60);
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
    this.announce(`COMBO x${n}!`);
  }

  /** Queue a short banner above the board (combo, streak, unlock, goal). */
  private announce(text: string, color?: string): void {
    this.announceQueue.push({ text, color });
    if (!this.announcing) this.nextAnnounce();
  }

  private nextAnnounce(): void {
    const item = this.announceQueue.shift();
    if (!item) {
      this.announcing = false;
      return;
    }
    this.announcing = true;
    const size = item.text.length > 16 ? 36 : 54;
    const t = item.color
      ? stoneText(this, W / 2, ANNOUNCE_Y, item.text, size, item.color).setDepth(70).setScale(0.4)
      : goldText(this, W / 2, ANNOUNCE_Y, item.text, size, 8).setDepth(70).setScale(0.4);
    this.tweens.add({
      targets: t,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: t,
          y: ANNOUNCE_Y - 50,
          alpha: 0,
          duration: 500,
          delay: 450,
          onComplete: () => {
            t.destroy();
            this.nextAnnounce();
          },
        });
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

  // ---------- boosters ----------
  private toggleAim(): void {
    if (this.busy || this.over || this.overlayOpen) return;
    this.aimToggledNow = true;
    if (this.aiming) {
      this.stopAim();
      return;
    }
    if (this.engine.hammers <= 0 || this.engine.tiles().length <= 2) return;
    this.aiming = true;
    this.aimHint = stoneText(this, W / 2, ANNOUNCE_Y, 'TAP A GEM TO SMASH IT', 34, '#ffd7a0').setDepth(70);
    this.tweens.add({ targets: this.aimHint, alpha: 0.5, duration: 450, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.tileLayer, alpha: 0.6, duration: 450, yoyo: true, repeat: -1 });
    this.hammerBtn.setScale(1.12);
  }

  private stopAim(): void {
    this.aiming = false;
    this.aimHint?.destroy();
    this.aimHint = null;
    this.tweens.killTweensOf(this.tileLayer);
    this.tileLayer.setAlpha(1);
    this.hammerBtn.setScale(1);
  }

  private aimTap(x: number, y: number): void {
    const g = this.geom;
    const inside = x >= BOARD_X && x <= BOARD_X + BOARD && y >= BOARD_Y && y <= BOARD_Y + BOARD;
    if (!inside) {
      this.stopAim();
      return;
    }
    let hit: Tile | null = null;
    for (const t of this.engine.tiles()) {
      if (Math.abs(x - g.cellX(t.c)) <= g.cell / 2 && Math.abs(y - g.cellY(t.r)) <= g.cell / 2) hit = t;
    }
    if (!hit) return;
    const removed = this.engine.hammer(hit.r, hit.c);
    this.stopAim();
    if (!removed) return;
    const s = this.sprites.get(removed.id);
    if (s) {
      this.sprites.delete(removed.id);
      this.tweens.add({ targets: s, scale: 0, angle: 40, duration: 160, ease: 'Quad.easeIn', onComplete: () => s.destroy() });
    }
    sfx.smash();
    void hapticMedium();
    this.cameras.main.shake(120, 0.005);
    this.burst(g.cellX(removed.c), g.cellY(removed.r), removed.value, 0);
    this.goalProgress.boostersUsed = true;
    this.afterBooster();
  }

  private shuffle(): void {
    if (this.busy || this.over || this.overlayOpen || this.aiming) return;
    if (!this.engine.shuffle()) return;
    this.busy = true;
    sfx.whoosh();
    void hapticMedium();
    const tiles = this.engine.tiles();
    // sprites were created for the old positions; the engine kept tile ids, so tween each to its new cell
    for (const t of tiles) {
      const s = this.sprites.get(t.id);
      if (!s) continue;
      this.tweens.add({ targets: s, x: this.cellX(t.c), y: this.cellY(t.r), duration: 320, ease: 'Cubic.easeInOut' });
    }
    this.time.delayedCall(340, () => {
      this.busy = false;
      this.goalProgress.boostersUsed = true;
      this.afterBooster();
    });
  }

  private undo(): void {
    if (this.busy || this.over || this.overlayOpen || this.aiming || !this.engine.undo()) return;
    this.goalProgress.boostersUsed = true;
    this.rebuildBoard();
    this.afterBooster();
  }

  private afterBooster(): void {
    this.refreshGoalProgress();
    this.refreshHud();
    this.persist();
    this.updateDanger();
  }

  // ---------- timed mode ----------
  private tickTimer(): void {
    if (this.timeLeft <= 0) return;
    this.timeLeft -= 1;
    this.refreshHud();
    if (this.timeLeft <= 10 && this.timeLeft > 0) {
      sfx.tick();
      this.tweens.add({ targets: this.rightText, scale: 1.25, duration: 120, yoyo: true });
    }
    if (this.timeLeft === 0) {
      this.stopAim();
      this.time.delayedCall(200, () => this.showOverlay(false, "TIME'S UP"));
    }
  }

  private fmtTime(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------- zen mode ----------
  private zenRelief(): void {
    this.busy = true;
    const removed = this.engine.clearSmallest();
    this.announce('THE TEMPLE MAKES ROOM', '#b8f0d0');
    sfx.whoosh();
    removed.forEach((t, i) => {
      const s = this.sprites.get(t.id);
      if (!s) return;
      this.sprites.delete(t.id);
      this.time.delayedCall(i * 40, () => {
        this.burst(this.cellX(t.c), this.cellY(t.r), t.value, 0);
        this.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => s.destroy() });
      });
    });
    this.time.delayedCall(removed.length * 40 + 300, () => {
      this.busy = false;
      this.refreshHud();
      this.persist();
      this.updateDanger();
    });
  }

  // ---------- danger (board almost full) ----------
  private updateDanger(): void {
    const empty = this.engine.emptyCells().length;
    const danger = !this.mode.zen && !this.over && empty <= 1 && this.engine.tiles().length >= this.mode.size * this.mode.size - 1;
    if (danger === this.danger) return;
    this.danger = danger;
    this.tweens.killTweensOf(this.vignette);
    if (danger) {
      this.tweens.add({ targets: this.vignette, alpha: { from: 0.25, to: 0.7 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.dangerTimer = this.time.addEvent({
        delay: 1050,
        loop: true,
        callback: () => {
          if (this.overlayOpen || document.hidden) return;
          sfx.heartbeat();
          this.frogReact();
        },
      });
    } else {
      this.tweens.add({ targets: this.vignette, alpha: 0, duration: 300 });
      this.dangerTimer?.remove();
      this.dangerTimer = null;
    }
  }

  // ---------- daily goals ----------
  private buildGoalStrip(y: number): void {
    img(this, W / 2, y, 'strip');
    const colW = 660 / 3;
    this.goals.forEach((g, i) => {
      const cx = BOARD_X + colW * i + colW / 2;
      const star = img(this, cx - 62, y, this.goalDone[i] ? 'star-on' : 'star-off').setScale(TEX * 0.6);
      const t = stoneText(this, cx + 14, y, g.short, 20, this.goalDone[i] ? '#fff2a8' : '#d9cf9a');
      this.goalStars.push(star);
      this.goalTexts.push(t);
    });
  }

  private refreshGoalProgress(): void {
    this.goalProgress.maxTile = Math.max(this.goalProgress.maxTile, this.engine.maxTile());
    this.goalProgress.score = this.engine.score;
  }

  private checkGoals(): void {
    if (this.mode.id !== 'daily') return;
    const now = evalGoals(this.goals, this.goalProgress);
    now.forEach((done, i) => {
      if (done && !this.goalDone[i]) {
        this.goalDone[i] = true;
        sfx.chime();
        void hapticSuccess();
        this.announce(`GOAL: ${this.goals[i].short}`, '#fff2a8');
        const star = this.goalStars[i];
        if (star) {
          star.setTexture('star-on');
          this.tweens.add({ targets: star, scale: TEX * 1.1, duration: 200, yoyo: true, ease: 'Back.easeOut' });
          this.goalTexts[i]?.setColor('#fff2a8');
        }
        progress.recordDaily(dayKey(), { stars: 0, score: this.engine.score, goals: [...this.goalDone] });
      }
    });
    this.refreshHud();
  }

  // ---------- hud & state ----------
  private refreshHud(): void {
    this.scoreText.setText(String(this.engine.score));
    if (this.mode.timeLimit) {
      this.rightText.setText(this.fmtTime(this.timeLeft));
      this.rightText.setColor(this.timeLeft <= 10 && this.timerStarted ? '#ff6a4a' : '#f5efd6');
    } else if (this.mode.id === 'daily') {
      this.rightText.setText(`${this.goalDone.filter(Boolean).length} / ${this.goals.length}`);
    } else {
      this.rightText.setText(String(this.engine.best));
    }
    const live = !this.over && !this.overlayOpen;
    this.undoBtn.setEnabled(live && this.engine.canUndo());
    this.hammerBtn.setEnabled(live && this.engine.hammers > 0);
    this.shuffleBtn.setEnabled(live && this.engine.shuffles > 0);
    this.setUndoBadge(this.engine.undos);
    this.setHammerBadge(this.engine.hammers);
    this.setShuffleBadge(this.engine.shuffles);
  }

  private persist(): void {
    if (!this.mode.resumable) return;
    const s: SaveState = {
      ...this.engine.save(),
      counted: this.counted,
      bestCombo: this.goalProgress.bestCombo,
      boostersUsed: this.goalProgress.boostersUsed,
    };
    if (this.mode.id === 'daily') s.dayKey = dayKey();
    writeSave(this.mode.id, s);
  }

  private rebuildBoard(): void {
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    for (const t of this.engine.tiles()) this.addSprite(t, true);
  }

  private newGame(): void {
    if (this.busy) return;
    this.stopAim();
    this.engine.reset();
    if (this.mode.id === 'daily') {
      // same seeded board again
      this.engine = new Engine(seededRandom(daySeed()), 4, this.mode.winValue, this.mode.boosters);
      this.engine.best = progress.bestFor('daily');
      this.goalDone = this.goals.map(() => false);
      this.goalStars.forEach((s) => s.setTexture('star-off'));
      this.goalTexts.forEach((t) => t.setColor('#d9cf9a'));
    }
    this.goalProgress = { maxTile: 0, score: 0, bestCombo: 0, boostersUsed: false };
    this.over = false;
    this.wonShown = false;
    this.counted = false;
    this.timerStarted = false;
    this.timeLeft = this.mode.timeLimit ?? 0;
    this.rebuildBoard();
    this.refreshGoalProgress();
    this.refreshHud();
    this.persist();
    this.updateDanger();
  }

  private toggleSound(): void {
    const muted = sfx.toggle();
    this.soundBtn.icon?.setTexture(muted ? 'icon-sound-off' : 'icon-sound-on');
  }

  private goHome(): void {
    this.stopAim();
    progress.flush();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Menu'));
  }

  // ---------- overlays ----------
  private overlayFrame(items: Phaser.GameObjects.GameObject[], panel: Phaser.GameObjects.Image): void {
    for (const o of items) {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(100);
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    }
    this.tweens.add({ targets: items, alpha: 1, duration: 300 });
    panel.setScale(0.8 * TEX);
    this.tweens.add({ targets: panel, scale: TEX, duration: 320, ease: 'Back.easeOut' });
  }

  private showOverlay(won: boolean, titleOverride?: string): void {
    if (this.overlayOpen) return;
    this.over = true;
    this.overlayOpen = true;
    this.stopAim();
    this.updateDanger();
    this.refreshHud();
    if (won) {
      sfx.win();
      void hapticSuccess();
    } else {
      sfx.lose();
      void hapticError();
      progress.recordGameEnd(this.engine.score, false);
    }
    const isDaily = this.mode.id === 'daily';
    let daily = null;
    if (isDaily) daily = progress.recordDaily(dayKey(), { stars: 0, score: this.engine.score, goals: [...this.goalDone] });

    const dim = addDim(this);
    const panel = img(this, W / 2, DESIGN_H / 2, 'panel');
    const title = goldText(
      this,
      W / 2,
      DESIGN_H / 2 - 170,
      titleOverride ?? (won ? 'SACRED GEM!' : 'GAME OVER'),
      titleOverride || !won ? 60 : 62,
      9,
    );
    const subLine = won
      ? `You forged the ${this.mode.winValue} gem`
      : this.mode.timeLimit
        ? 'The sands have run out'
        : 'The temple is full';
    const sub = stoneText(this, W / 2, DESIGN_H / 2 - 95, subLine, 28, '#d9cf9a');
    const score = stoneText(this, W / 2, DESIGN_H / 2 - 20, `SCORE  ${this.engine.score}`, 44);
    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title, sub, score];

    if (isDaily && daily) {
      const stars = daily.goals.map((g, i) => img(this, W / 2 - 60 + i * 60, DESIGN_H / 2 + 45, g ? 'star-on' : 'star-off').setScale(TEX * 0.9));
      items.push(...stars);
    } else {
      items.push(stoneText(this, W / 2, DESIGN_H / 2 + 40, `BEST  ${this.engine.best}`, 30, '#ffe9a8'));
    }

    const close = () => {
      items.forEach((o) => o.destroy());
      this.overlayOpen = false;
    };

    const shareBtn = makeIconButton(this, W / 2 + 238, DESIGN_H / 2 - 232, 'icon-share', 'button-sm', () => this.share());
    shareBtn.setScale(0.8);
    items.push(shareBtn);

    if (won) {
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 125, 'KEEP GOING', 'button', () => {
          close();
          this.over = false;
          this.refreshHud();
          this.updateDanger();
        }, 30),
      );
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 220, isDaily ? 'RESTART' : 'NEW GAME', 'button', () => {
          close();
          this.newGame();
        }, 30),
      );
      // celebratory burst of orbs
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => this.burst(140 + Math.random() * 440, 500 + Math.random() * 500, [256, 512, 1024, 2048][i % 4], 0));
    } else {
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 135, isDaily ? 'RETRY' : 'TRY AGAIN', 'button', () => {
          close();
          this.newGame();
        }, 32),
      );
      items.push(
        makeButton(this, W / 2, DESIGN_H / 2 + 225, isDaily ? 'TRIALS' : 'MENU', 'button', () => {
          close();
          this.scene.start(isDaily ? 'Daily' : 'Menu');
        }, 30),
      );
    }

    this.overlayFrame(items, panel);
    if (!won) writeSave(this.mode.id, null);
  }

  private async share(): Promise<void> {
    const extra =
      this.mode.id === 'daily'
        ? `Daily trial ${dayKey()}: ${this.goalDone.map((g) => (g ? '★' : '☆')).join('')}`
        : progress.data.streak >= 2
          ? `${progress.data.streak}-day streak`
          : '';
    const outcome = await shareText('Temple 2048', scoreShareText(this.mode.name, this.engine.score, this.engine.maxTile(), extra));
    if (outcome === 'copied') this.announce('COPIED TO CLIPBOARD', '#d9cf9a');
  }

  // ---------- daily intro ----------
  private showDailyIntro(): void {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    this.refreshHud();
    const dim = addDim(this, 0.6);
    const panel = img(this, W / 2, DESIGN_H / 2, 'panel');
    const title = goldText(this, W / 2, DESIGN_H / 2 - 180, "TODAY'S TRIALS", 54, 8);
    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title];
    this.goals.forEach((g, i) => {
      const y = DESIGN_H / 2 - 95 + i * 70;
      items.push(img(this, W / 2 - 220, y, this.goalDone[i] ? 'star-on' : 'star-off').setScale(TEX * 0.8));
      items.push(stoneText(this, W / 2 + 20, y, g.label, 26, '#f5efd6'));
    });
    items.push(stoneText(this, W / 2, DESIGN_H / 2 + 125, 'Everyone gets this same board today', 22, '#9fc49a'));
    items.push(
      makeButton(this, W / 2, DESIGN_H / 2 + 200, 'BEGIN', 'button', () => {
        items.forEach((o) => o.destroy());
        this.overlayOpen = false;
        this.refreshHud();
      }, 32),
    );
    this.overlayFrame(items, panel);
  }

  // ---------- tutorial ----------
  private showTutorial(): void {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    this.refreshHud();
    const dim = addDim(this, 0.7);
    const panel = img(this, W / 2, DESIGN_H / 2, 'panel');
    const title = goldText(this, W / 2, DESIGN_H / 2 - 185, 'HOW TO PLAY', 54, 8);
    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title];

    // two demo gems that slide together and merge, with a swiping hand
    const y = DESIGN_H / 2 - 95;
    const a = this.add.image(W / 2 - 110, y, orbKey(2)).setScale(this.geom.orbScale * 0.8);
    const b = this.add.image(W / 2 + 30, y, orbKey(2)).setScale(this.geom.orbScale * 0.8);
    const c = this.add.image(W / 2 + 110, y, orbKey(4)).setScale(this.geom.orbScale * 0.8).setAlpha(0);
    const hand = img(this, W / 2 - 60, y + 58, 'hand');
    items.push(a, b, c, hand);
    const loop = () => {
      if (!this.overlayOpen) return;
      a.setPosition(W / 2 - 110, y).setAlpha(1);
      b.setPosition(W / 2 + 30, y).setAlpha(1);
      c.setAlpha(0).setScale(this.geom.orbScale * 0.5);
      hand.setPosition(W / 2 - 60, y + 58);
      this.tweens.add({ targets: hand, x: W / 2 + 60, duration: 500, ease: 'Quad.easeInOut', delay: 300 });
      this.tweens.add({ targets: [a, b], x: W / 2 + 110, duration: 300, delay: 500, ease: 'Quad.easeIn', onComplete: () => {
        a.setAlpha(0);
        b.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, scale: this.geom.orbScale * 0.8, duration: 200, ease: 'Back.easeOut' });
        this.time.delayedCall(1100, loop);
      } });
    };
    loop();

    const lines = ['Swipe to slide every gem', 'Equal gems merge into one', `Forge the ${this.mode.winValue} Sacred Gem`];
    lines.forEach((l, i) => items.push(stoneText(this, W / 2, DESIGN_H / 2 + 25 + i * 42, l, 26, i === 2 ? '#fff2a8' : '#f5efd6')));
    items.push(stoneText(this, W / 2, DESIGN_H / 2 + 155, 'Hammer smashes a gem · Shuffle rearranges', 20, '#9fc49a'));
    items.push(
      makeButton(this, W / 2, DESIGN_H / 2 + 215, 'GOT IT', 'button', () => {
        items.forEach((o) => o.destroy());
        this.overlayOpen = false;
        progress.finishTutorial();
        this.refreshHud();
      }, 32),
    );
    this.overlayFrame(items, panel);
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
      this.refreshHud();
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

    this.overlayFrame(items, panel);
    this.tweens.add({ targets: stars, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
