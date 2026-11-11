import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { W, H, DPR } from './game/Textures';
import { rating } from './game/Rating';

// The canvas is DPR x the logical design size; every scene zooms its camera by DPR,
// so game logic works in 720 x 1280 units while phones get a crisp high-density render.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W * DPR,
  height: H * DPR,
  backgroundColor: '#06331f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 1 },
  scene: [BootScene, MenuScene, GameScene],
});

// Some WebViews / emulated viewports resize without firing Phaser's own listener; refresh explicitly.
const refresh = () => game.scale.refresh();
window.addEventListener('resize', refresh);
window.addEventListener('orientationchange', () => setTimeout(refresh, 100));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(refresh, 50);
});
[200, 600, 1500].forEach((ms) => setTimeout(refresh, ms));

if (import.meta.env.DEV) {
  const w = window as unknown as { __rating: typeof rating; __game: Phaser.Game };
  w.__rating = rating;
  w.__game = game;
}
