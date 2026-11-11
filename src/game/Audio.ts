// Tiny WebAudio synth so the game has Zuma-like pops without shipping audio files.

const KEY = 'temple2048:muted';

class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(KEY) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture on iOS. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** soft click when the orbs slide */
  slide(): void {
    this.tone(220, 0.07, 'triangle', 0.08, 140);
  }

  /** Zuma-style pop; pitch rises with the orb value */
  pop(value: number, index = 0): void {
    const step = Math.log2(value); // 1..13
    const f = 320 + step * 55;
    this.tone(f * 1.6, 0.12, 'sine', 0.22, f * 0.7, index * 0.045);
    this.tone(f * 3.1, 0.06, 'square', 0.04, f * 2, index * 0.045);
  }

  combo(n: number): void {
    for (let i = 0; i < Math.min(n, 4); i++) this.tone(520 + i * 130, 0.1, 'triangle', 0.12, undefined, 0.05 * i + 0.12);
  }

  win(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, undefined, i * 0.11));
  }

  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.06, f * 0.9, i * 0.22));
  }

  tap(): void {
    this.tone(880, 0.05, 'sine', 0.08, 660);
  }
}

export const sfx = new Sfx();
