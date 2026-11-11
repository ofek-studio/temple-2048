import Phaser from 'phaser';
import { buildTextures } from '../game/Textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildTextures(this);
    this.scene.start('Menu');
  }
}
