import Phaser from 'phaser';
import { W, DESIGN_H, TEX } from '../game/Textures';
import { goldText, stoneText, makeButton, makeIconButton, img, setupCamera, addBackground, addFireflies } from '../game/UI';
import { progress, loadSave, dayKey } from '../game/Progress';
import { dailyGoals, prettyDay } from '../game/Daily';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export class DailyScene extends Phaser.Scene {
  constructor() {
    super('Daily');
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    addBackground(this);
    addFireflies(this);

    const today = dayKey();
    goldText(this, W / 2, 80, 'DAILY TRIAL', 60, 8);
    stoneText(this, W / 2, 138, prettyDay(today), 24, '#9fc49a');

    img(this, W / 2, 690, 'panel-tall');

    // today's goals
    goldText(this, W / 2, 230, "TODAY'S GOALS", 36, 6);
    const result = progress.dailyResult(today);
    dailyGoals(today).forEach((g, i) => {
      const y = 292 + i * 58;
      const done = !!result?.goals[i];
      img(this, W / 2 - 230, y, done ? 'star-on' : 'star-off').setScale(TEX * 0.8);
      stoneText(this, W / 2 + 10, y, g.label, 25, done ? '#fff2a8' : '#f5efd6');
    });
    if (result) stoneText(this, W / 2, 478, `BEST TODAY   ${result.stars}/3 ★   ·   ${result.score} pts`, 22, '#ffe9a8');
    else stoneText(this, W / 2, 478, 'Not attempted yet', 22, '#9fc49a');

    // calendar
    const [yy, mm] = today.split('-').map(Number);
    const monthName = new Date(yy, mm - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    goldText(this, W / 2, 545, monthName.toUpperCase(), 30, 5);
    const colW = 78;
    const x0 = W / 2 - colW * 3;
    WEEKDAYS.forEach((d, i) => stoneText(this, x0 + i * colW, 592, d, 18, '#9fc49a'));
    const first = new Date(yy, mm - 1, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(yy, mm, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const idx = offset + d - 1;
      const cx = x0 + (idx % 7) * colW;
      const cy = 640 + Math.floor(idx / 7) * 58;
      const key = `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = progress.data.daily[key];
      const isToday = key === today;
      if (r && r.stars > 0) {
        const star = img(this, cx, cy, 'star-on').setScale(TEX * 1.05);
        if (r.stars < 3) star.setTint(0xb0a070);
      } else if (key < today) {
        img(this, cx, cy, 'star-off').setScale(TEX * 0.9).setAlpha(0.35);
      }
      if (isToday) {
        const ring = this.add.circle(cx, cy + 2, 26).setStrokeStyle(3, 0xf3d060);
        this.tweens.add({ targets: ring, scale: 1.12, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      }
      stoneText(this, cx, cy + 2, String(d), 18, key > today ? '#6f6a55' : r && r.stars > 0 ? '#3a2405' : '#f5efd6');
    }

    // streak + totals
    const streak = progress.data.streak;
    const sy = 1010;
    img(this, W / 2 - 215, sy, 'icon-flame').setScale(TEX * 0.9);
    stoneText(this, W / 2 - 185, sy, `${streak} DAY STREAK`, 26, streak > 0 ? '#ffb347' : '#d9cf9a').setOrigin(0, 0.5);
    stoneText(this, W / 2 + 230, sy, `BEST ${progress.data.bestStreak}`, 20, '#d9cf9a').setOrigin(1, 0.5);
    stoneText(this, W / 2, sy + 42, `${progress.totalStars()} stars collected in total`, 20, '#9fc49a');

    const save = loadSave('daily', 4);
    const resume = !!save && save.dayKey === today;
    const label = resume ? 'CONTINUE TRIAL' : result ? 'TRY AGAIN' : 'BEGIN TRIAL';
    makeButton(this, W / 2, 1130, label, 'button-wide', () => this.fadeTo('Game', { mode: 'daily', fresh: !resume }), 32);

    makeIconButton(this, 58, 66, 'icon-home', 'button-sm', () => this.fadeTo('Menu'));
    stoneText(this, W / 2, DESIGN_H - 28, 'same board for every player, every day', 18, '#9fc49a').setAlpha(0.8);
  }

  private fadeTo(scene: string, data?: object): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }
}
