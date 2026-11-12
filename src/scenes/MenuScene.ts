import Phaser from 'phaser';
import { W, DESIGN_H, TEX, orbKey, ORB_SCALE } from '../game/Textures';
import { goldText, stoneText, makeButton, makeIconButton, img, setupCamera, addBackground, addTorch, addFireflies } from '../game/UI';
import { progress, loadSave, dayKey } from '../game/Progress';
import { sfx } from '../game/Audio';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    addBackground(this);

    // floating decorative orbs
    const values = [2, 4, 8, 16, 32, 64, 128, 256];
    for (let i = 0; i < 8; i++) {
      const v = values[i % values.length];
      const x = i % 2 === 0 ? 80 + ((i * 97) % (W - 160)) : i % 4 === 1 ? 70 : W - 70;
      const y = i % 2 === 0 ? 120 + ((i * 173) % 300) : 560 + ((i * 131) % 160);
      const orb = this.add.image(x, y, orbKey(v)).setScale(ORB_SCALE * (0.55 + (i % 3) * 0.2));
      orb.setAlpha(0.92);
      this.tweens.add({
        targets: orb,
        y: y - 18 - (i % 3) * 8,
        duration: 1600 + i * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });
    }

    addTorch(this, 70, 150);
    addTorch(this, W - 70, 150);

    goldText(this, W / 2, 230, 'TEMPLE', 120, 14);
    goldText(this, W / 2, 350, '2048', 118, 14);
    stoneText(this, W / 2, 445, 'MERGE THE SACRED GEMS', 28, '#cfe6c0');

    const FROG = 0.86 * TEX;
    const frog = img(this, W / 2, 745, 'frog').setOrigin(0.5, 1).setScale(FROG);
    const lids = img(this, W / 2, 745, 'frog-lids').setOrigin(0.5, 1).setScale(FROG).setVisible(false);
    this.tweens.add({
      targets: [frog, lids],
      scaleY: FROG * 0.975,
      scaleX: FROG * 1.02,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const blink = () => {
      if (!this.scene.isActive()) return;
      lids.setVisible(true);
      this.time.delayedCall(130, () => lids.setVisible(false));
      this.time.delayedCall(2600 + Math.random() * 2500, blink);
    };
    this.time.delayedCall(1800, blink);

    addFireflies(this);

    // best + streak line
    const best = progress.bestFor('classic');
    const streak = progress.data.streak;
    const lineY = 790;
    if (streak > 0) {
      const label = stoneText(this, W / 2 + 24, lineY, `${streak} DAY STREAK`, 30, progress.playedToday() ? '#ffb347' : '#d9cf9a');
      const flame = img(this, label.x - label.width / 2 - 30, lineY - 2, 'icon-flame').setScale(TEX * 0.9);
      if (!progress.playedToday()) {
        flame.setAlpha(0.6);
        this.tweens.add({ targets: flame, alpha: 1, duration: 600, yoyo: true, repeat: -1 });
        stoneText(this, W / 2, lineY + 34, 'play today to keep it alive', 18, '#9fc49a');
      }
      if (best > 0) stoneText(this, W / 2, lineY - 40, `BEST  ${best}`, 26, '#ffe9a8');
    } else if (best > 0) {
      stoneText(this, W / 2, lineY, `BEST  ${best}`, 32, '#ffe9a8');
    }

    // main buttons
    const hasGame = !!loadSave('classic', 4);
    const rowY = 870;
    if (hasGame) {
      makeButton(this, W / 2 - 135, rowY, 'CONTINUE', 'button', () => this.start('classic', false), 30);
      makeButton(this, W / 2 + 135, rowY, 'NEW GAME', 'button', () => this.start('classic', true), 28);
    } else {
      const btn = makeButton(this, W / 2, rowY, 'PLAY', 'button-wide', () => this.start('classic', true), 38);
      this.tweens.add({ targets: btn, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const today = progress.dailyResult(dayKey());
    const dailyLabel = today ? `DAILY TRIAL   ${today.stars}/3 ★` : 'DAILY TRIAL';
    const daily = makeButton(this, W / 2, rowY + 96, dailyLabel, 'button-wide', () => this.go('Daily'), 30);
    if (!today) {
      const dot = img(this, 190, -30, 'badge').setScale(TEX * 0.9);
      daily.add(dot);
      this.tweens.add({ targets: dot, scale: TEX * 1.15, duration: 600, yoyo: true, repeat: -1 });
    }
    makeButton(this, W / 2, rowY + 192, 'MORE MODES', 'button-wide', () => this.go('Modes'), 30);

    // temple (gallery + stats) and sound
    const iconY = rowY + 300;
    makeIconButton(this, W / 2 - 80, iconY, 'icon-temple', 'button-sm', () => this.go('Temple'));
    stoneText(this, W / 2 - 80, iconY + 58, 'TEMPLE', 18, '#d9cf9a');
    const sound = makeIconButton(this, W / 2 + 80, iconY, sfx.muted ? 'icon-sound-off' : 'icon-sound-on', 'button-sm', () => {
      const muted = sfx.toggle();
      sound.icon?.setTexture(muted ? 'icon-sound-off' : 'icon-sound-on');
    });
    stoneText(this, W / 2 + 80, iconY + 58, 'SOUND', 18, '#d9cf9a');

    stoneText(this, W / 2, DESIGN_H - 28, 'swipe to move  •  match gems to merge', 20, '#9fc49a').setAlpha(0.8);

    this.input.once('pointerdown', () => sfx.unlock());
  }

  private start(mode: 'classic', fresh: boolean): void {
    this.fadeTo('Game', { mode, fresh });
  }

  private go(scene: string): void {
    this.fadeTo(scene);
  }

  private fadeTo(scene: string, data?: object): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(scene, data);
    });
  }
}
