import Phaser from 'phaser';
import { W, DESIGN_H, TEX, ORB_SCALE, ORB_STYLES, orbKey, orbColorInt } from '../game/Textures';
import { goldText, stoneText, makeButton, makeIconButton, img, setupCamera, addBackground, addFireflies } from '../game/UI';
import { progress } from '../game/Progress';
import { shareText } from '../game/Share';

const GEMS = Object.keys(ORB_STYLES).map(Number).sort((a, b) => a - b); // 2 .. 8192

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export class TempleScene extends Phaser.Scene {
  constructor() {
    super('Temple');
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    addBackground(this);
    addFireflies(this);

    goldText(this, W / 2, 80, 'THE TEMPLE', 60, 8);
    const unlockedCount = GEMS.filter((v) => progress.isUnlocked(v)).length;
    stoneText(this, W / 2, 138, `${unlockedCount} of ${GEMS.length} sacred gems forged`, 24, '#9fc49a');

    img(this, W / 2, 690, 'panel-tall');

    // ---- gem gallery: 5 columns x 3 rows ----
    goldText(this, W / 2, 222, 'GEM GALLERY', 36, 6);
    const cols = 5;
    const colW = 112;
    const rowH = 122;
    const x0 = W / 2 - ((cols - 1) * colW) / 2;
    GEMS.forEach((v, i) => {
      const cx = x0 + (i % cols) * colW;
      const cy = 300 + Math.floor(i / cols) * rowH;
      const unlocked = progress.isUnlocked(v);
      const orb = this.add.image(cx, cy, orbKey(v)).setScale(ORB_SCALE * 0.6);
      if (unlocked) {
        if (v >= 512) {
          const glow = this.add.image(cx, cy, 'glow').setTint(orbColorInt(v)).setAlpha(0.4).setScale(0.45 * TEX);
          glow.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: glow, alpha: 0.15, duration: 900 + (i % 3) * 200, yoyo: true, repeat: -1 });
          orb.setDepth(1);
        }
        stoneText(this, cx, cy + 1, String(v), v >= 1000 ? 18 : 22, v === 2 || v === 4 || v === 2048 ? '#4a3a1e' : '#ffffff').setDepth(2);
        const day = progress.data.unlocked[String(v)];
        if (day) stoneText(this, cx, cy + 50, day.slice(5).replace('-', '/'), 13, '#9fc49a');
        orb.setScale(0);
        this.tweens.add({ targets: orb, scale: ORB_SCALE * 0.6, duration: 260, delay: 80 + i * 40, ease: 'Back.easeOut' });
      } else {
        orb.setTint(0x202020).setAlpha(0.55);
        stoneText(this, cx, cy + 1, '?', 28, '#8a8470');
        stoneText(this, cx, cy + 50, v >= 1000 ? `${v}` : `${v}`, 13, '#6f6a55');
      }
    });

    // ---- chronicles (stats) ----
    goldText(this, W / 2, 690, 'CHRONICLES', 36, 6);
    const s = progress.data.stats;
    const rows: [string, string][] = [
      ['Games played', String(s.games)],
      ['Best score', String(progress.bestFor('classic'))],
      ['Highest gem', s.highestTile ? String(s.highestTile) : '-'],
      ['Gems merged', s.merges.toLocaleString('en-US')],
      ['Best combo', s.bestCombo ? `x${s.bestCombo}` : '-'],
      ['Sacred gems forged', String(s.wins)],
      ['Time in the temple', fmtTime(s.playSeconds)],
      ['Day streak', `${progress.data.streak}  (best ${progress.data.bestStreak})`],
      ['Daily stars', String(progress.totalStars())],
    ];
    rows.forEach(([k, v], i) => {
      const y = 745 + i * 40;
      stoneText(this, W / 2 - 250, y, k, 22, '#d9cf9a').setOrigin(0, 0.5);
      stoneText(this, W / 2 + 250, y, v, 22, '#fff2a8').setOrigin(1, 0.5);
    });

    makeButton(this, W / 2, 1150, 'SHARE MY TEMPLE', 'button-wide', () => void this.share(), 30);
    makeIconButton(this, 58, 66, 'icon-home', 'button-sm', () => this.fadeTo('Menu'));
    stoneText(this, W / 2, DESIGN_H - 28, 'every gem you forge for the first time is kept here', 18, '#9fc49a').setAlpha(0.8);
  }

  private async share(): Promise<void> {
    const s = progress.data.stats;
    const text = [
      'My Temple 2048 chronicles',
      `Best score ${progress.bestFor('classic').toLocaleString('en-US')} · Highest gem ${s.highestTile || '-'}`,
      `${GEMS.filter((v) => progress.isUnlocked(v)).length}/${GEMS.length} gems forged · ${progress.data.streak}-day streak · ${progress.totalStars()} daily stars`,
      'Can you beat it? Play Temple 2048',
    ].join('\n');
    const outcome = await shareText('Temple 2048', text);
    if (outcome === 'copied') {
      const t = stoneText(this, W / 2, 1100, 'COPIED TO CLIPBOARD', 22, '#8ff0c0').setDepth(50);
      this.tweens.add({ targets: t, alpha: 0, y: 1080, delay: 900, duration: 400, onComplete: () => t.destroy() });
    }
  }

  private fadeTo(scene: string, data?: object): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }
}
