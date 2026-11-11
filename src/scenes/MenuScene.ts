import Phaser from 'phaser';
import { W, DESIGN_H, TEX, orbKey, ORB_SCALE } from '../game/Textures';
import { goldText, stoneText, makeButton, img, setupCamera, addBackground, addTorch, addFireflies } from '../game/UI';
import { loadSave, loadBest } from '../game/Storage';
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
      // upper orbs drift around the title, lower ones hug the screen edges below the idol
      const x = i % 2 === 0 ? 80 + ((i * 97) % (W - 160)) : i % 4 === 1 ? 70 : W - 70;
      const y = i % 2 === 0 ? 120 + ((i * 173) % 300) : 900 + ((i * 131) % 220);
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
    stoneText(this, W / 2, 445, 'MERGE THE SACRED ORBS', 28, '#cfe6c0');

    const frog = img(this, W / 2, 835, 'frog').setOrigin(0.5, 1).setScale(1.12 * TEX);
    const lids = img(this, W / 2, 835, 'frog-lids').setOrigin(0.5, 1).setScale(1.12 * TEX).setVisible(false);
    this.tweens.add({
      targets: [frog, lids],
      scaleY: 1.09 * TEX,
      scaleX: 1.14 * TEX,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const blink = () => {
      lids.setVisible(true);
      this.time.delayedCall(130, () => lids.setVisible(false));
      this.time.delayedCall(2600 + Math.random() * 2500, blink);
    };
    this.time.delayedCall(1800, blink);

    addFireflies(this);

    const best = loadBest();
    if (best > 0) stoneText(this, W / 2, 885, `BEST  ${best}`, 34, '#ffe9a8');

    const save = loadSave();
    const hasGame = !!save && save.grid.some((row) => row.some((v) => v !== null));

    if (hasGame) {
      makeButton(this, W / 2, 975, 'CONTINUE', 'button', () => this.start(false), 34);
      makeButton(this, W / 2, 1075, 'NEW GAME', 'button', () => this.start(true), 30);
    } else {
      const btn = makeButton(this, W / 2, 1000, 'PLAY', 'button', () => this.start(true), 38);
      this.tweens.add({ targets: btn, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    stoneText(this, W / 2, DESIGN_H - 60, 'swipe to move  •  match orbs to merge', 22, '#9fc49a').setAlpha(0.8);

    this.input.once('pointerdown', () => sfx.unlock());
  }

  private start(fresh: boolean): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Game', { fresh });
    });
  }
}
