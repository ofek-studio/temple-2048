import Phaser from 'phaser';
import { W, TEX } from '../game/Textures';
import { goldText, stoneText, makeIconButton, img, setupCamera, addBackground, addFireflies, type Button } from '../game/UI';
import { progress, loadSave } from '../game/Progress';
import { MODES, PICKABLE_MODES, type ModeId } from '../game/Modes';
import { sfx } from '../game/Audio';
import { hapticLight } from '../game/Native';

export class ModesScene extends Phaser.Scene {
  constructor() {
    super('Modes');
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    addBackground(this);
    addFireflies(this);

    goldText(this, W / 2, 110, 'CHOOSE YOUR TRIAL', 56, 8);
    stoneText(this, W / 2, 165, 'Every mode keeps its own best score', 22, '#9fc49a');

    PICKABLE_MODES.forEach((id, i) => {
      const mode = MODES[id];
      const y = 290 + i * 150;
      const bg = img(this, 0, 0, 'button-mode');
      const name = goldText(this, 0, -22, mode.name, 36, 6);
      const blurb = stoneText(this, 0, 24, mode.blurb, 20, '#d9cf9a');
      const children: Phaser.GameObjects.GameObject[] = [bg, name, blurb];
      const best = progress.bestFor(id);
      if (best > 0) children.push(stoneText(this, 262, -24, `BEST ${best}`, 15, '#ffe9a8').setOrigin(1, 0.5));
      const resume = mode.resumable && !!loadSave(id, mode.size);
      if (resume) children.push(stoneText(this, -262, -24, 'IN PROGRESS', 13, '#8ff0c0').setOrigin(0, 0.5));
      if (mode.timeLimit) children.push(img(this, -240, -24, 'icon-clock').setScale(TEX * 0.8));
      const c = this.add.container(W / 2, y, children) as Button;
      c.setSize(bg.displayWidth, bg.displayHeight);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.96, duration: 60, yoyo: true }));
      c.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!c.getBounds().contains(p.worldX, p.worldY)) return;
        sfx.unlock();
        sfx.tap();
        void hapticLight();
        this.play(id, !resume);
      });
      c.setAlpha(0).setX(W / 2 + 40);
      this.tweens.add({ targets: c, alpha: 1, x: W / 2, duration: 260, delay: i * 70, ease: 'Quad.easeOut' });
    });

    makeIconButton(this, 58, 66, 'icon-home', 'button-sm', () => this.fadeTo('Menu'));
    stoneText(this, W / 2, 1060, 'Daily Trial lives on the main menu', 18, '#9fc49a').setAlpha(0.8);
  }

  private play(mode: ModeId, fresh: boolean): void {
    this.fadeTo('Game', { mode, fresh });
  }

  private fadeTo(scene: string, data?: object): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }
}
