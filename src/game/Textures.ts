// Procedural "Zuma-style" art: glossy orbs, carved stone board, jungle temple background, frog idol.
// Everything is drawn with the Canvas 2D API at boot, so the app ships with zero image assets.
// All textures are rasterised at DPR x their logical size and displayed at scale TEX for crisp phones.

import Phaser from 'phaser';

export const W = 720;
export const DESIGN_H = 1280;
/** Canvas height (logical units): at least the design height, taller on long phones. */
export const H = (() => {
  const iw = Math.max(1, window.innerWidth);
  const ih = Math.max(1, window.innerHeight);
  return Math.min(1700, Math.max(DESIGN_H, Math.round((W * ih) / iw)));
})();
/** Offset of the 1280-tall design inside the H-tall background canvas. */
export const OY = Math.round((H - DESIGN_H) / 2);

/** Texture super-sampling factor. The camera zooms by DPR, textures display at 1/DPR. */
export const DPR = 2;
export const TEX = 1 / DPR;

export const BOARD = 660;
export const PAD = 20;
export const GAP = 16;
export const CELL = (BOARD - PAD * 2 - GAP * 3) / 4; // 143
export const BALL = CELL - 10; // displayed orb diameter
export const BALL_TEX = 192; // logical texture size
export const ORB_SCALE = (BALL / BALL_TEX) * TEX;

export const BOARD_X = (W - BOARD) / 2;
export const BOARD_Y = 440;

/** Geometry for an n x n board inside the same 660px stone slab. */
export interface BoardGeom {
  n: number;
  cell: number;
  orbScale: number;
  /** font scale relative to the 4x4 board */
  fontScale: number;
  cellX(c: number): number;
  cellY(r: number): number;
}
export function boardGeom(n: number): BoardGeom {
  const cell = (BOARD - PAD * 2 - GAP * (n - 1)) / n;
  return {
    n,
    cell,
    orbScale: ((cell - 10) / BALL_TEX) * TEX,
    fontScale: cell / CELL,
    cellX: (c) => BOARD_X + PAD + cell / 2 + c * (cell + GAP),
    cellY: (r) => BOARD_Y + PAD + cell / 2 + r * (cell + GAP),
  };
}
export function boardKey(n: number): string {
  return `board-${n}`;
}

export const FROG_W = 340;
export const FROG_H = 300;

export interface OrbStyle {
  base: string;
  text: string;
  band?: boolean;
  rainbow?: boolean;
}

export const ORB_STYLES: Record<number, OrbStyle> = {
  2: { base: '#ece6cf', text: '#4a3a1e' },
  4: { base: '#f8d339', text: '#4a3a1e' },
  8: { base: '#ff8f2a', text: '#ffffff' },
  16: { base: '#e9403d', text: '#ffffff' },
  32: { base: '#b53bd6', text: '#ffffff' },
  64: { base: '#2f74f6', text: '#ffffff' },
  128: { base: '#1fc47c', text: '#ffffff', band: true },
  256: { base: '#19c0d4', text: '#ffffff', band: true },
  512: { base: '#ff4fa9', text: '#ffffff', band: true },
  1024: { base: '#ffb312', text: '#ffffff', band: true },
  2048: { base: '#ffe066', text: '#5a3b00', band: true, rainbow: true },
  4096: { base: '#2b2b3a', text: '#ffd45c', band: true },
  8192: { base: '#171722', text: '#ffd45c', band: true, rainbow: true },
};

export function orbStyle(value: number): OrbStyle {
  return ORB_STYLES[value] ?? ORB_STYLES[8192];
}

export function orbKey(value: number): string {
  return `orb-${ORB_STYLES[value] ? value : 8192}`;
}

// ---------- colour helpers ----------
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb(c: [number, number, number], a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}
function mix(hex: string, towards: [number, number, number], t: number): [number, number, number] {
  const c = hexToRgb(hex);
  return [c[0] + (towards[0] - c[0]) * t, c[1] + (towards[1] - c[1]) * t, c[2] + (towards[2] - c[2]) * t];
}
const lighten = (hex: string, t: number) => rgb(mix(hex, [255, 255, 255], t));
const darken = (hex: string, t: number) => rgb(mix(hex, [0, 0, 0], t));

export function orbColorInt(value: number): number {
  const [r, g, b] = hexToRgb(orbStyle(value).base);
  return (r << 16) | (g << 8) | b;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.round(w * DPR), Math.round(h * DPR))!;
  const ctx = tex.context;
  ctx.scale(DPR, DPR);
  return { tex, ctx };
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
}

function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, rnd: () => number) {
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const a = 0.05 + rnd() * 0.12;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(px, py, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

function goldGradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f6dc7a');
  g.addColorStop(0.5, '#b8891f');
  g.addColorStop(1, '#f1cf5e');
  return g;
}

/** Small Aztec step glyph used on stone trims. */
function glyph(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s * 0.3);
  ctx.fillRect(x, y, s * 0.3, s);
  ctx.fillRect(x + s * 0.4, y + s * 0.4, s * 0.6, s * 0.3);
  ctx.fillRect(x + s * 0.7, y + s * 0.4, s * 0.3, s * 0.6);
}

// ---------- orbs ----------
function drawOrb(ctx: Ctx, S: number, style: OrbStyle) {
  // Glossy bevelled gem block (square tile) in the orb's colour.
  const m = 10; // margin for the drop shadow
  const x = m;
  const y = m;
  const w = S - m * 2;
  const r = w * 0.17;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = darken(style.base, 0.45);
  roundRect(ctx, x, y, w, w, r);
  ctx.fill();
  ctx.restore();

  // body
  const g = ctx.createLinearGradient(x, y, x + w, y + w);
  g.addColorStop(0, lighten(style.base, 0.35));
  g.addColorStop(0.5, style.base);
  g.addColorStop(1, darken(style.base, 0.35));
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, w, r);
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, w, r);
  ctx.clip();

  if (style.rainbow) {
    const anyCtx = ctx as unknown as { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
    if (anyCtx.createConicGradient) {
      const cg = anyCtx.createConicGradient(-0.6, S / 2, S / 2);
      const hues = ['#ff5f6d', '#ffc371', '#fff26b', '#6bff9b', '#6bd5ff', '#b36bff', '#ff5f6d'];
      hues.forEach((h, i) => cg.addColorStop(i / (hues.length - 1), h));
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = cg;
      ctx.fillRect(x, y, w, w);
      ctx.globalAlpha = 1;
    }
  }

  // diagonal shine stripe
  if (style.band) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, y);
    ctx.lineTo(x + w * 0.8, y);
    ctx.lineTo(x + w * 0.2, y + w);
    ctx.lineTo(x, y + w);
    ctx.lineTo(x, y + w * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  // bevel: light top/left edges, dark bottom/right edges
  const bev = w * 0.12;
  const top = ctx.createLinearGradient(0, y, 0, y + bev);
  top.addColorStop(0, 'rgba(255,255,255,0.55)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, bev);
  const left = ctx.createLinearGradient(x, 0, x + bev, 0);
  left.addColorStop(0, 'rgba(255,255,255,0.35)');
  left.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = left;
  ctx.fillRect(x, y, bev, w);
  const bottom = ctx.createLinearGradient(0, y + w - bev, 0, y + w);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = bottom;
  ctx.fillRect(x, y + w - bev, w, bev);
  const right = ctx.createLinearGradient(x + w - bev, 0, x + w, 0);
  right.addColorStop(0, 'rgba(0,0,0,0)');
  right.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = right;
  ctx.fillRect(x + w - bev, y, bev, w);

  // glass highlight across the upper half
  const hg = ctx.createLinearGradient(0, y, 0, y + w * 0.48);
  hg.addColorStop(0, 'rgba(255,255,255,0.5)');
  hg.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = hg;
  roundRect(ctx, x + bev * 0.6, y + bev * 0.5, w - bev * 1.2, w * 0.46, r * 0.8);
  ctx.fill();

  // small sharp sparkle in the corner
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.2, y + w * 0.17, w * 0.07, w * 0.035, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  roundRect(ctx, x + 1, y + 1, w - 2, w - 2, r);
  ctx.stroke();
}

// ---------- stone board ----------
function goldBand(ctx: Ctx, x: number, y: number, w: number, h: number, thick: number) {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 22);
  roundRectPath(ctx, x + thick, y + thick, w - thick * 2, h - thick * 2, 14);
  ctx.fillStyle = goldGradient(ctx, x, y, x + w, y + h);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(60,35,0,0.55)';
  const step = 26;
  for (let px = x + 30; px < x + w - 30; px += step) {
    ctx.fillRect(px, y + thick / 2 - 3, 8, 6);
    ctx.fillRect(px, y + h - thick / 2 - 3, 8, 6);
  }
  for (let py = y + 30; py < y + h - 30; py += step) {
    ctx.fillRect(x + thick / 2 - 3, py, 6, 8);
    ctx.fillRect(x + w - thick / 2 - 3, py, 6, 8);
  }
  ctx.restore();
  const corners = [
    [x + 4, y + 4],
    [x + w - 4, y + 4],
    [x + 4, y + h - 4],
    [x + w - 4, y + h - 4],
  ];
  for (const [mx, my] of corners) {
    const mg = ctx.createRadialGradient(mx - 4, my - 4, 2, mx, my, 22);
    mg.addColorStop(0, '#ffe79a');
    mg.addColorStop(1, '#8e6512');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const gem = ctx.createRadialGradient(mx - 3, my - 3, 1, mx, my, 9);
    gem.addColorStop(0, '#ff9d9d');
    gem.addColorStop(1, '#7a0f1f');
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(mx - 3, my - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoard(ctx: Ctx, n = 4) {
  const cell = (BOARD - PAD * 2 - GAP * (n - 1)) / n;
  const socketCenter = (r: number, c: number): [number, number] => [
    PAD + cell / 2 + c * (cell + GAP),
    PAD + cell / 2 + r * (cell + GAP),
  ];
  const rnd = seeded(7);
  const S = BOARD;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#8a8873');
  g.addColorStop(0.5, '#6d6b5c');
  g.addColorStop(1, '#53524a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, 6, 6, S - 12, S - 12, 30);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, 6, 6, S - 12, S - 12, 30);
  ctx.clip();
  speckle(ctx, 0, 0, S, S, 9000, rnd);
  for (let i = 0; i < 7; i++) {
    const mx = rnd() * S;
    const my = rnd() * S;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 40 + rnd() * 50);
    mg.addColorStop(0, 'rgba(70,110,50,0.28)');
    mg.addColorStop(1, 'rgba(70,110,50,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, S, S);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    let x = rnd() * S;
    let y = rnd() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 60;
      y += (rnd() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // carved grid lines between the sockets
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  for (let k = 1; k < n; k++) {
    const p = PAD + k * (cell + GAP) - GAP / 2;
    ctx.beginPath();
    ctx.moveTo(PAD + 10, p);
    ctx.lineTo(S - PAD - 10, p);
    ctx.moveTo(p, PAD + 10);
    ctx.lineTo(p, S - PAD - 10);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  for (let k = 1; k < n; k++) {
    const p = PAD + k * (cell + GAP) - GAP / 2 + 2;
    ctx.beginPath();
    ctx.moveTo(PAD + 10, p);
    ctx.lineTo(S - PAD - 10, p);
    ctx.moveTo(p, PAD + 10);
    ctx.lineTo(p, S - PAD - 10);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  roundRect(ctx, 8, 8, S - 16, S - 16, 28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 10, 10, S - 20, S - 20, 26);
  ctx.stroke();

  goldBand(ctx, 14, 14, S - 28, S - 28, 16);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [cx, cy] = socketCenter(r, c);
      const R = cell / 2 - 4;
      const rad = Math.round(20 * (cell / CELL));
      const sg = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      sg.addColorStop(0, '#121109');
      sg.addColorStop(1, '#3a3830');
      ctx.fillStyle = sg;
      roundRect(ctx, cx - R, cy - R, R * 2, R * 2, rad);
      ctx.fill();
      // inner shadow: dark along the top/left walls
      ctx.save();
      roundRect(ctx, cx - R, cy - R, R * 2, R * 2, rad);
      ctx.clip();
      const topS = ctx.createLinearGradient(0, cy - R, 0, cy - R + 26);
      topS.addColorStop(0, 'rgba(0,0,0,0.8)');
      topS.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topS;
      ctx.fillRect(cx - R, cy - R, R * 2, 26);
      const leftS = ctx.createLinearGradient(cx - R, 0, cx - R + 18, 0);
      leftS.addColorStop(0, 'rgba(0,0,0,0.6)');
      leftS.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = leftS;
      ctx.fillRect(cx - R, cy - R, 18, R * 2);
      // carved sun glyph on the socket floor
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.48, cy + Math.sin(a) * R * 0.48);
        ctx.lineTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
        ctx.stroke();
      }
      ctx.restore();
      // lip highlight on the bottom edge
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - R + rad, cy + R + 1);
      ctx.lineTo(cx + R - rad, cy + R + 1);
      ctx.stroke();
    }
  }
}

// ---------- jungle temple background ----------
function leaf(ctx: Ctx, x: number, y: number, len: number, wid: number, rot: number, fill: string, vein: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
  ctx.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
  ctx.fill();
  ctx.strokeStyle = vein;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    ctx.moveTo(0, -len * t);
    ctx.lineTo(wid * 0.5 * (1 - t), -len * t - len * 0.08);
    ctx.moveTo(0, -len * t);
    ctx.lineTo(-wid * 0.5 * (1 - t), -len * t - len * 0.08);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBackground(ctx: Ctx) {
  const rnd = seeded(42);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a5e44');
  g.addColorStop(0.4, '#0d3b2c');
  g.addColorStop(1, '#04160f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, OY);
  const steps = [
    [560, 470],
    [460, 395],
    [360, 320],
    [260, 250],
    [160, 185],
  ];
  for (const [w, top] of steps) {
    const tg = ctx.createLinearGradient(0, top, 0, 470);
    tg.addColorStop(0, 'rgba(60,110,90,0.55)');
    tg.addColorStop(1, 'rgba(20,60,45,0.55)');
    ctx.fillStyle = tg;
    ctx.fillRect(W / 2 - w / 2, top, w, 470 - top);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(W / 2 - w / 2, top, w, 8);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 190; y < 470; y += 18) ctx.fillRect(W / 2 - 40, y, 80, 6);

  ctx.save();
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 7; i++) {
    const x0 = 80 + i * 95;
    const grad = ctx.createLinearGradient(0, -OY, 0, 900);
    grad.addColorStop(0, '#e4ffd6');
    grad.addColorStop(1, 'rgba(228,255,214,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 - 20, -OY - 10);
    ctx.lineTo(x0 + 50, -OY - 10);
    ctx.lineTo(x0 + 260 - i * 50, 900);
    ctx.lineTo(x0 + 90 - i * 50, 900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  const greens: [string, string][] = [
    ['#0b3b2a', 'rgba(0,0,0,0.25)'],
    ['#0f4f36', 'rgba(0,0,0,0.25)'],
    ['#083024', 'rgba(0,0,0,0.3)'],
    ['#146243', 'rgba(255,255,255,0.08)'],
    ['#1b7a52', 'rgba(255,255,255,0.1)'],
  ];
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    let x: number;
    let y: number;
    if (side === 0) { x = rnd() * 150 - 50; y = rnd() * H; }
    else if (side === 1) { x = W - rnd() * 150 + 50; y = rnd() * H; }
    else if (side === 2) { x = rnd() * W; y = rnd() * 140 - 50; }
    else { x = rnd() * W; y = H - rnd() * 160 + 50; }
    const toCenter = Math.atan2(H / 2 - y, W / 2 - x) + Math.PI / 2;
    const [fill, vein] = greens[i % greens.length];
    leaf(ctx, x, y, 150 + rnd() * 170, 44 + rnd() * 44, toCenter + (rnd() - 0.5) * 0.9, fill, vein);
  }

  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 120 + rnd() * 60;
    const len = 140 + rnd() * 160;
    ctx.strokeStyle = '#0a2f21';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, -5);
    ctx.bezierCurveTo(x + 30, len * 0.3, x - 30, len * 0.6, x + 10, len);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const t = (k + 1) / 7;
      const vx = x + Math.sin(t * Math.PI * 2) * 25;
      const vy = len * t;
      leaf(ctx, vx, vy, 34, 12, (k % 2 ? 1 : -1) * 1.2, k % 2 ? '#146243' : '#0f4f36', 'rgba(0,0,0,0.2)');
    }
  }

  for (let i = 0; i < 45; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const fg = ctx.createRadialGradient(x, y, 0, x, y, 6);
    fg.addColorStop(0, 'rgba(230,255,170,0.9)');
    fg.addColorStop(1, 'rgba(230,255,170,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const mist = ctx.createLinearGradient(0, H - 420, 0, H);
  mist.addColorStop(0, 'rgba(180,230,200,0)');
  mist.addColorStop(0.7, 'rgba(180,230,200,0.12)');
  mist.addColorStop(1, 'rgba(180,230,200,0.22)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, H - 420, W, 420);

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------- frog idol ----------
function drawFrog(ctx: Ctx) {
  const rnd = seeded(3);
  const body = ctx.createLinearGradient(0, 60, 0, 240);
  body.addColorStop(0, '#9cc56f');
  body.addColorStop(1, '#3b6a35');
  const dark = '#1f3d1d';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  const pg = ctx.createLinearGradient(0, 230, 0, 300);
  pg.addColorStop(0, '#8d8b78');
  pg.addColorStop(1, '#4e4c41');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(170, 262, 165, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(170, 262, 165, 34, 0, 0, Math.PI * 2);
  ctx.clip();
  speckle(ctx, 0, 220, FROG_W, 80, 900, rnd);
  ctx.restore();
  ctx.strokeStyle = goldGradient(ctx, 10, 240, 330, 280);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(170, 258, 150, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 9; i++) glyph(ctx, 50 + i * 30, 250, 12, 'rgba(50,30,0,0.45)');

  ctx.save();
  ctx.translate(10, 0);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#4f7f45';
  ctx.beginPath();
  ctx.ellipse(52, 200, 46, 26, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(268, 200, 46, 26, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(160, 170, 118, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(222,236,180,0.9)';
  ctx.beginPath();
  ctx.ellipse(160, 192, 76, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(160, 112, 98, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(160, 112, 98, 62, 0, 0, Math.PI * 2);
  ctx.ellipse(160, 170, 118, 68, 0, 0, Math.PI * 2);
  ctx.clip();
  speckle(ctx, 0, 0, 320, 250, 1100, rnd);
  ctx.fillStyle = 'rgba(30,70,30,0.35)';
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.arc(60 + rnd() * 200, 120 + rnd() * 110, 4 + rnd() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(200,230,140,0.3)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(80 + rnd() * 160, 130 + rnd() * 50, 3 + rnd() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = goldGradient(ctx, 60, 150, 260, 170);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(160, 128, 78, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  for (const [gx, gy, col] of [
    [118, 192, '#3bb1ff'],
    [160, 206, '#ff4b5c'],
    [202, 192, '#38e07a'],
  ] as [number, number, string][]) {
    const gg = ctx.createRadialGradient(gx - 2, gy - 2, 1, gx, gy, 8);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.3, col);
    gg.addColorStop(1, darken(col, 0.5));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx, gy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const ex of [104, 216]) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(ex, 66, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.stroke();
    const eg = ctx.createRadialGradient(ex - 8, 58, 2, ex, 66, 30);
    eg.addColorStop(0, '#fffbe6');
    eg.addColorStop(1, '#d9c98f');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex, 66, 29, 0, Math.PI * 2);
    ctx.fill();
    const ig = ctx.createRadialGradient(ex, 66, 2, ex, 66, 20);
    ig.addColorStop(0, '#ffe98a');
    ig.addColorStop(0.6, '#e8a71f');
    ig.addColorStop(1, '#8f5d08');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ex, 66, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120d05';
    ctx.beginPath();
    ctx.ellipse(ex, 66, 6, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(ex - 9, 56, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(ex, 40, 40, 20, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, 66, 29, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.strokeStyle = dark;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(90, 128);
  ctx.quadraticCurveTo(160, 172, 230, 128);
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(146, 104, 4, 0, Math.PI * 2);
  ctx.arc(174, 104, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5f8f52';
  for (const fx of [92, 228]) {
    ctx.beginPath();
    ctx.ellipse(fx, 228, 36, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const t of [-22, 0, 22]) {
      ctx.beginPath();
      ctx.arc(fx + t, 238, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const [fx, col, rot] of [
    [128, '#19c0d4', -0.5],
    [160, '#e9403d', 0],
    [192, '#19c0d4', 0.5],
  ] as [number, string, number][]) {
    leaf(ctx, fx, 30, 48, 12, rot, col, 'rgba(0,0,0,0.25)');
  }

  ctx.fillStyle = goldGradient(ctx, 100, 20, 220, 50);
  ctx.beginPath();
  ctx.moveTo(114, 46);
  ctx.lineTo(134, 8);
  ctx.lineTo(150, 34);
  ctx.lineTo(160, 0);
  ctx.lineTo(170, 34);
  ctx.lineTo(186, 8);
  ctx.lineTo(206, 46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a3d05';
  ctx.lineWidth = 2;
  ctx.stroke();
  const gem = ctx.createRadialGradient(157, 30, 1, 160, 34, 9);
  gem.addColorStop(0, '#ff9d9d');
  gem.addColorStop(1, '#8a0f1f');
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.arc(160, 34, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Closed eyelids on a transparent canvas the size of the frog; shown briefly to blink. */
function drawFrogLids(ctx: Ctx) {
  ctx.translate(10, 0);
  for (const ex of [104, 216]) {
    const g = ctx.createLinearGradient(0, 40, 0, 95);
    g.addColorStop(0, '#8fbb66');
    g.addColorStop(1, '#4b7a40');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, 66, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f3d1d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex - 26, 70);
    ctx.quadraticCurveTo(ex, 82, ex + 26, 70);
    ctx.stroke();
  }
}

// ---------- plaques, buttons, torch, icons ----------
function drawPlaque(ctx: Ctx, w: number, h: number, light: boolean, glyphs = false) {
  const rnd = seeded(11);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, light ? '#938f7a' : '#625f50');
  g.addColorStop(1, light ? '#5c5a4c' : '#3a382f');
  ctx.fillStyle = g;
  roundRect(ctx, 4, 4, w - 8, h - 8, 16);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, 4, 4, w - 8, h - 8, 16);
  ctx.clip();
  speckle(ctx, 0, 0, w, h, Math.floor((w * h) / 70), rnd);
  ctx.restore();
  ctx.strokeStyle = goldGradient(ctx, 0, 0, w, 0);
  ctx.lineWidth = 4;
  roundRect(ctx, 6, 6, w - 12, h - 12, 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 10, 10, w - 20, h - 20, 11);
  ctx.stroke();
  if (glyphs) {
    for (let x = 22; x < w - 30; x += 24) {
      glyph(ctx, x, 14, 10, 'rgba(255,230,150,0.25)');
      glyph(ctx, x, h - 26, 10, 'rgba(255,230,150,0.25)');
    }
  }
}

function drawTorch(ctx: Ctx) {
  const rnd = seeded(5);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  const wg = ctx.createLinearGradient(30, 0, 50, 0);
  wg.addColorStop(0, '#6b4322');
  wg.addColorStop(0.5, '#a0652f');
  wg.addColorStop(1, '#4e2f14');
  ctx.fillStyle = wg;
  roundRect(ctx, 31, 60, 18, 130, 6);
  ctx.fill();
  ctx.restore();
  const cg = ctx.createLinearGradient(20, 30, 60, 30);
  cg.addColorStop(0, '#4a3a2a');
  cg.addColorStop(0.5, '#7a6248');
  cg.addColorStop(1, '#3a2c1f');
  ctx.fillStyle = cg;
  roundRect(ctx, 22, 34, 36, 40, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  for (let y = 42; y < 72; y += 8) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(58, y + 4);
    ctx.stroke();
  }
  const sg = ctx.createLinearGradient(0, 120, 0, 170);
  sg.addColorStop(0, '#8a8873');
  sg.addColorStop(1, '#4e4c41');
  ctx.fillStyle = sg;
  roundRect(ctx, 12, 125, 56, 40, 8);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 12, 125, 56, 40, 8);
  ctx.clip();
  speckle(ctx, 12, 125, 56, 40, 200, rnd);
  ctx.restore();
  ctx.strokeStyle = goldGradient(ctx, 12, 0, 68, 0);
  ctx.lineWidth = 3;
  roundRect(ctx, 15, 128, 50, 34, 6);
  ctx.stroke();
  glyph(ctx, 33, 137, 14, 'rgba(50,30,0,0.5)');
  const eg = ctx.createRadialGradient(40, 40, 2, 40, 40, 30);
  eg.addColorStop(0, 'rgba(255,170,60,0.8)');
  eg.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, 80, 90);
}

function drawIconUndo(ctx: Ctx, S: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = () => {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2 + 2, S * 0.27, Math.PI * 0.1, Math.PI * 1.55, false);
    ctx.stroke();
    const a = Math.PI * 1.55;
    const hx = S / 2 + Math.cos(a) * S * 0.27;
    const hy = S / 2 + 2 + Math.sin(a) * S * 0.27;
    ctx.beginPath();
    ctx.moveTo(hx - 13, hy - 1);
    ctx.lineTo(hx + 2, hy + 2);
    ctx.lineTo(hx - 1, hy + 16);
    ctx.stroke();
  };
  ctx.strokeStyle = '#3a2405';
  ctx.lineWidth = 12;
  draw();
  ctx.strokeStyle = '#f3d060';
  ctx.lineWidth = 6;
  draw();
}

function drawIconSound(ctx: Ctx, S: number, on: boolean) {
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(S * 0.18, S * 0.4);
    ctx.lineTo(S * 0.32, S * 0.4);
    ctx.lineTo(S * 0.48, S * 0.26);
    ctx.lineTo(S * 0.48, S * 0.74);
    ctx.lineTo(S * 0.32, S * 0.6);
    ctx.lineTo(S * 0.18, S * 0.6);
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2405';
  ctx.lineWidth = 8;
  body();
  ctx.stroke();
  ctx.fillStyle = '#f3d060';
  body();
  ctx.fill();
  if (on) {
    for (const r of [S * 0.17, S * 0.28]) {
      ctx.strokeStyle = '#3a2405';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(S * 0.48, S * 0.5, r, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
      ctx.strokeStyle = '#f3d060';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(S * 0.48, S * 0.5, r, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
    }
  } else {
    for (const [c, lw] of [
      ['#3a2405', 12],
      ['#e9403d', 6],
    ] as [string, number][]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(S * 0.6, S * 0.36);
      ctx.lineTo(S * 0.82, S * 0.64);
      ctx.moveTo(S * 0.82, S * 0.36);
      ctx.lineTo(S * 0.6, S * 0.64);
      ctx.stroke();
    }
  }
}


/** Two-tone stroke helper: dark outline then gold line, same path. */
function twoTone(ctx: Ctx, path: () => void, gold = '#f3d060', outer = 12, inner = 6) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2405';
  ctx.lineWidth = outer;
  path();
  ctx.stroke();
  ctx.strokeStyle = gold;
  ctx.lineWidth = inner;
  path();
  ctx.stroke();
}

function drawIconHammer(ctx: Ctx, S: number) {
  // handle
  twoTone(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(S * 0.3, S * 0.78);
    ctx.lineTo(S * 0.58, S * 0.5);
  }, '#c98c3a', 14, 8);
  // head
  ctx.save();
  ctx.translate(S * 0.62, S * 0.4);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#3a2405';
  roundRect(ctx, -S * 0.26, -S * 0.15, S * 0.52, S * 0.3, 6);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -S * 0.1, 0, S * 0.1);
  g.addColorStop(0, '#fff0b0');
  g.addColorStop(1, '#d9a62e');
  ctx.fillStyle = g;
  roundRect(ctx, -S * 0.22, -S * 0.11, S * 0.44, S * 0.22, 5);
  ctx.fill();
  ctx.restore();
}

function drawIconShuffle(ctx: Ctx, S: number) {
  const arrow = (y0: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(S * 0.16, y0);
    ctx.bezierCurveTo(S * 0.5, y0, S * 0.5, y2, S * 0.78, y2);
    const up = y2 < y0 ? 1 : -1;
    ctx.moveTo(S * 0.66, y2 + up * S * 0.12);
    ctx.lineTo(S * 0.82, y2);
    ctx.lineTo(S * 0.66, y2 - up * S * 0.12);
  };
  twoTone(ctx, () => arrow(S * 0.3, S * 0.7), '#f3d060', 11, 5);
  twoTone(ctx, () => arrow(S * 0.7, S * 0.3), '#f3d060', 11, 5);
}

function drawIconHome(ctx: Ctx, S: number) {
  twoTone(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(S * 0.16, S * 0.52);
    ctx.lineTo(S * 0.5, S * 0.2);
    ctx.lineTo(S * 0.84, S * 0.52);
    ctx.moveTo(S * 0.26, S * 0.46);
    ctx.lineTo(S * 0.26, S * 0.8);
    ctx.lineTo(S * 0.74, S * 0.8);
    ctx.lineTo(S * 0.74, S * 0.46);
  });
}

function drawIconTemple(ctx: Ctx, S: number) {
  twoTone(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(S * 0.14, S * 0.42);
    ctx.lineTo(S * 0.5, S * 0.16);
    ctx.lineTo(S * 0.86, S * 0.42);
    ctx.closePath();
    for (const x of [0.26, 0.5, 0.74]) {
      ctx.moveTo(S * x, S * 0.46);
      ctx.lineTo(S * x, S * 0.74);
    }
    ctx.moveTo(S * 0.16, S * 0.8);
    ctx.lineTo(S * 0.84, S * 0.8);
  }, '#f3d060', 10, 5);
}

function drawIconShare(ctx: Ctx, S: number) {
  const dot = (x: number, y: number) => {
    ctx.fillStyle = '#3a2405';
    ctx.beginPath();
    ctx.arc(x, y, S * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3d060';
    ctx.beginPath();
    ctx.arc(x, y, S * 0.085, 0, Math.PI * 2);
    ctx.fill();
  };
  twoTone(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(S * 0.72, S * 0.25);
    ctx.lineTo(S * 0.3, S * 0.5);
    ctx.lineTo(S * 0.72, S * 0.75);
  }, '#f3d060', 10, 4);
  dot(S * 0.72, S * 0.25);
  dot(S * 0.3, S * 0.5);
  dot(S * 0.72, S * 0.75);
}

function drawIconClock(ctx: Ctx, S: number) {
  twoTone(ctx, () => {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
    ctx.moveTo(S / 2, S * 0.3);
    ctx.lineTo(S / 2, S / 2);
    ctx.lineTo(S * 0.66, S * 0.6);
  }, '#f3d060', 11, 5);
}

function drawIconFlame(ctx: Ctx, S: number) {
  const flame = (scale: number, fill: string) => {
    ctx.save();
    ctx.translate(S / 2, S * 0.56);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.42);
    ctx.bezierCurveTo(S * 0.3, -S * 0.15, S * 0.34, S * 0.1, S * 0.18, S * 0.3);
    ctx.bezierCurveTo(S * 0.08, S * 0.42, -S * 0.08, S * 0.42, -S * 0.18, S * 0.3);
    ctx.bezierCurveTo(-S * 0.34, S * 0.1, -S * 0.3, -S * 0.15, 0, -S * 0.42);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  };
  flame(1.08, '#3a2405');
  flame(0.95, '#ff7a1a');
  flame(0.62, '#ffd45c');
}

function drawIconStar(ctx: Ctx, S: number, filled: boolean) {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? S * 0.42 : S * 0.19;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + 4 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2405';
  ctx.lineWidth = 8;
  path();
  ctx.stroke();
  if (filled) {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(1, '#e0a324');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = 'rgba(20,16,8,0.55)';
  }
  path();
  ctx.fill();
}

function drawBadge(ctx: Ctx, S: number) {
  ctx.fillStyle = '#3a2405';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#ff6a4a');
  g.addColorStop(1, '#b4211c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawVignette(ctx: Ctx, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, 'rgba(255,0,0,0)');
  g.addColorStop(0.6, 'rgba(230,30,10,0.55)');
  g.addColorStop(1, 'rgba(255,40,10,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawHand(ctx: Ctx, S: number) {
  // simple pointing hand for the tutorial
  ctx.fillStyle = '#3a2405';
  ctx.beginPath();
  ctx.arc(S * 0.5, S * 0.62, S * 0.3, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, S * 0.4, S * 0.08, S * 0.2, S * 0.6, S * 0.1);
  ctx.fill();
  ctx.fillStyle = '#ffe3b8';
  ctx.beginPath();
  ctx.arc(S * 0.5, S * 0.62, S * 0.24, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, S * 0.44, S * 0.12, S * 0.12, S * 0.56, S * 0.06);
  ctx.fill();
}

function drawSoftCircle(ctx: Ctx, S: number) {
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

function drawRing(ctx: Ctx, S: number) {
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
}

export function buildTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (ctx: Ctx) => void) => {
    const { tex, ctx } = canvas(scene, key, w, h);
    draw(ctx);
    tex.refresh();
  };
  for (const [v, style] of Object.entries(ORB_STYLES)) make(`orb-${v}`, BALL_TEX, BALL_TEX, (c) => drawOrb(c, BALL_TEX, style));
  for (const n of [3, 4, 5]) make(boardKey(n), BOARD, BOARD, (c) => drawBoard(c, n));
  make('bg', W, H, drawBackground);
  make('frog', FROG_W, FROG_H, drawFrog);
  make('frog-lids', FROG_W, FROG_H, drawFrogLids);
  make('plaque', 220, 110, (c) => drawPlaque(c, 220, 110, false));
  make('title-plaque', 600, 120, (c) => drawPlaque(c, 600, 120, false, true));
  make('button', 260, 84, (c) => drawPlaque(c, 260, 84, true));
  make('button-sm', 110, 84, (c) => drawPlaque(c, 110, 84, true));
  make('panel', 600, 520, (c) => drawPlaque(c, 600, 520, false, true));
  make('torch', 80, 200, drawTorch);
  make('button-wide', 440, 84, (c) => drawPlaque(c, 440, 84, true));
  make('button-mode', 600, 110, (c) => drawPlaque(c, 600, 110, true));
  make('panel-tall', 640, 1040, (c) => drawPlaque(c, 640, 1040, false, true));
  make('strip', 660, 60, (c) => drawPlaque(c, 660, 60, false));
  make('icon-undo', 64, 64, (c) => drawIconUndo(c, 64));
  make('icon-hammer', 64, 64, (c) => drawIconHammer(c, 64));
  make('icon-shuffle', 64, 64, (c) => drawIconShuffle(c, 64));
  make('icon-home', 64, 64, (c) => drawIconHome(c, 64));
  make('icon-temple', 64, 64, (c) => drawIconTemple(c, 64));
  make('icon-share', 64, 64, (c) => drawIconShare(c, 64));
  make('icon-clock', 64, 64, (c) => drawIconClock(c, 64));
  make('icon-flame', 64, 64, (c) => drawIconFlame(c, 64));
  make('star-on', 64, 64, (c) => drawIconStar(c, 64, true));
  make('star-off', 64, 64, (c) => drawIconStar(c, 64, false));
  make('badge', 40, 40, (c) => drawBadge(c, 40));
  make('vignette', W, H, (c) => drawVignette(c, W, H));
  make('hand', 96, 96, (c) => drawHand(c, 96));
  make('icon-sound-on', 64, 64, (c) => drawIconSound(c, 64, true));
  make('icon-sound-off', 64, 64, (c) => drawIconSound(c, 64, false));
  make('spark', 32, 32, (c) => drawSoftCircle(c, 32));
  make('glow', 256, 256, (c) => drawSoftCircle(c, 256));
  make('ring', 128, 128, (c) => drawRing(c, 128));
}
