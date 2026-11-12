import Phaser from 'phaser';
import { sfx } from './Audio';
import { hapticLight } from './Native';
import { TEX, W, H, DESIGN_H, DPR } from './Textures';

export const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

/** Textures are rasterised at DPR x; this adds one at its logical size. */
export function img(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(TEX);
}

/** Camera setup shared by every scene: zoom by DPR and centre the 1280-tall design. */
export function setupCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(DPR);
  cam.centerOn(W / 2, DESIGN_H / 2);
}

export function addBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return img(scene, W / 2, DESIGN_H / 2, 'bg');
}

/** Full-screen dim rectangle used by overlays (covers the whole H-tall canvas). */
export function addDim(scene: Phaser.Scene, alpha = 0.65): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(W / 2, DESIGN_H / 2, W, H, 0x000000, alpha).setInteractive();
}

export function goldText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  stroke = Math.max(4, size / 9),
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: '#f3d060',
      stroke: '#3a2405',
      strokeThickness: stroke,
      resolution: DPR,
    })
    .setOrigin(0.5);
  const grad = t.context.createLinearGradient(0, 0, 0, t.height);
  grad.addColorStop(0, '#fff2a8');
  grad.addColorStop(0.45, '#f1c84a');
  grad.addColorStop(0.55, '#c68f16');
  grad.addColorStop(1, '#ffe27a');
  t.setFill(grad);
  t.setShadow(0, 4, 'rgba(0,0,0,0.6)', 6, false, true);
  return t;
}

export function stoneText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = '#f5efd6',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#1d170a',
      strokeThickness: Math.max(3, size / 10),
      resolution: DPR,
    })
    .setOrigin(0.5);
}

export interface Button extends Phaser.GameObjects.Container {
  label?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  setEnabled(on: boolean): void;
}

function wireButton(scene: Phaser.Scene, c: Button, bg: Phaser.GameObjects.Image, onClick: () => void) {
  c.setSize(bg.displayWidth, bg.displayHeight);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  c.setEnabled = (on: boolean) => {
    enabled = on;
    c.setAlpha(on ? 1 : 0.45);
  };
  c.on('pointerdown', () => {
    if (!enabled) return;
    scene.tweens.add({ targets: c, scale: 0.93, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
  });
  c.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!enabled) return;
    if (!c.getBounds().contains(p.worldX, p.worldY)) return;
    sfx.unlock();
    sfx.tap();
    void hapticLight();
    onClick();
  });
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  texture: string,
  onClick: () => void,
  fontSize = 30,
): Button {
  const bg = img(scene, 0, 0, texture);
  const label = goldText(scene, 0, 0, text, fontSize);
  const c = scene.add.container(x, y, [bg, label]) as Button;
  c.label = label;
  wireButton(scene, c, bg, onClick);
  return c;
}

export function makeIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  iconKey: string,
  texture: string,
  onClick: () => void,
): Button {
  const bg = img(scene, 0, 0, texture);
  const icon = img(scene, 0, 0, iconKey);
  const c = scene.add.container(x, y, [bg, icon]) as Button;
  c.icon = icon;
  wireButton(scene, c, bg, onClick);
  return c;
}

/** Animated torch: bracket image, flickering glow and a flame particle emitter. */
export function addTorch(scene: Phaser.Scene, x: number, y: number): void {
  img(scene, x, y, 'torch').setOrigin(0.5, 0);
  const glow = img(scene, x, y + 40, 'glow').setTint(0xff9a2e).setAlpha(0.35).setScale(0.6 * TEX);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.25, to: 0.45 },
    scale: { from: 0.55 * TEX, to: 0.75 * TEX },
    duration: 420,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.add.particles(x, y + 42, 'spark', {
    x: { min: -7, max: 7 },
    speedY: { min: -70, max: -130 },
    speedX: { min: -12, max: 12 },
    scale: { start: 1.1 * TEX, end: 0 },
    alpha: { start: 0.9, end: 0 },
    lifespan: { min: 380, max: 720 },
    tint: [0xfff1a8, 0xffc24a, 0xff7a1a, 0xff3d00],
    blendMode: Phaser.BlendModes.ADD,
    frequency: 28,
    quantity: 1,
  });
}

/** Slow drifting fireflies over the whole screen. */
export function addFireflies(scene: Phaser.Scene): void {
  scene.add.particles(0, 0, 'spark', {
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Rectangle(0, DESIGN_H / 2 - H / 2, W, H),
      quantity: 1,
    },
    speed: { min: 6, max: 22 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.45 * TEX, end: 0.15 * TEX },
    alpha: { values: [0, 0.9, 0.9, 0], ease: 'Sine.easeInOut' },
    lifespan: { min: 3500, max: 7000 },
    tint: [0xe6ffaa, 0xc8ff8a, 0xfff4b0],
    blendMode: Phaser.BlendModes.ADD,
    frequency: 260,
    quantity: 1,
  });
}

/** Small red counter pinned to a button's top-right corner. Returns an updater. */
export function addBadge(scene: Phaser.Scene, btn: Button, count: number): (n: number) => void {
  const bg = img(scene, 40, -28, 'badge');
  const txt = stoneText(scene, 40, -28, String(count), 20);
  btn.add([bg, txt]);
  return (n: number) => {
    const show = n > 0 && n < 99;
    bg.setVisible(show);
    txt.setVisible(show);
    txt.setText(String(n));
  };
}

/** Icon button with a text label under it (used on the menu). */
export function makeLabeledIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  iconKey: string,
  label: string,
  onClick: () => void,
): Button {
  const btn = makeIconButton(scene, x, y, iconKey, 'button-sm', onClick);
  stoneText(scene, x, y + 62, label, 20, '#d9cf9a');
  return btn;
}
