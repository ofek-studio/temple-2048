// Tiny WebAudio synth so the game has Zuma-like pops without shipping audio files,
// plus a generative ambient "temple" music loop and the danger heartbeat.

const KEY = 'temple2048:muted';
const MUSIC_KEY = 'temple2048:music';

// D minor pentatonic spread over three octaves (Hz)
const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
const CHORDS: number[][] = [
  [146.83, 220.0, 293.66], // Dm
  [174.61, 261.63, 349.23], // F
  [130.81, 196.0, 261.63], // C
  [110.0, 164.81, 220.0], // Am
];

class Sfx {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private delay: DelayNode | null = null;
  private musicTimer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private chord = 0;
  muted = false;
  musicOn = true;

  constructor() {
    try {
      this.muted = localStorage.getItem(KEY) === '1';
      this.musicOn = localStorage.getItem(MUSIC_KEY) !== '0';
    } catch {
      /* storage unavailable */
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (!this.muted) void this.ctx.resume();
    });
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
    if (this.musicOn && !this.muted) this.startMusic();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.muted) this.stopMusic();
    else if (this.musicOn) this.startMusic();
    return this.muted;
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    try {
      localStorage.setItem(MUSIC_KEY, this.musicOn ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.musicOn && !this.muted) this.startMusic();
    else this.stopMusic();
    return this.musicOn;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0, dest?: AudioNode) {
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
    osc.connect(gain).connect(dest ?? ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---------- effects ----------
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

  /** stone smash for the hammer booster */
  smash(): void {
    this.tone(180, 0.18, 'sawtooth', 0.14, 60);
    this.tone(90, 0.25, 'square', 0.08, 40, 0.02);
  }

  /** whoosh for the shuffle booster */
  whoosh(): void {
    this.tone(300, 0.35, 'triangle', 0.1, 900);
    this.tone(600, 0.3, 'sine', 0.06, 1400, 0.05);
  }

  /** new gem unlocked / goal achieved */
  chime(): void {
    [784, 1046, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.14, undefined, i * 0.09));
  }

  /** low thump used while the board is almost full */
  heartbeat(): void {
    this.tone(62, 0.22, 'sine', 0.26, 40);
    this.tone(58, 0.2, 'sine', 0.2, 38, 0.24);
  }

  tick(): void {
    this.tone(1200, 0.03, 'square', 0.05, 900);
  }

  // ---------- music ----------
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const ctx = this.ctx;
    this.music = ctx.createGain();
    this.music.gain.value = 0.0001;
    this.music.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
    this.music.connect(ctx.destination);
    // echo bus for the plucks
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.music);
    this.nextBeat = ctx.currentTime + 0.1;
    this.beat = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 400);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.music && this.ctx) {
      const g = this.music;
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      setTimeout(() => g.disconnect(), 1500);
    }
    this.music = null;
    this.delay = null;
  }

  private schedule(): void {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx;
    const BEAT = 0.82; // ~73 bpm
    while (this.nextBeat < ctx.currentTime + 1.0) {
      const t = this.nextBeat - ctx.currentTime;
      // slow pad chord every 8 beats
      if (this.beat % 8 === 0) {
        const chord = CHORDS[this.chord % CHORDS.length];
        this.chord += 1;
        for (const f of chord) this.pad(f, BEAT * 8.5, t);
      }
      // sparse plucked melody, denser on off-beats
      const p = this.beat % 2 === 0 ? 0.3 : 0.45;
      if (Math.random() < p) {
        const f = SCALE[Math.floor(Math.random() * SCALE.length)];
        this.pluck(f, t + (Math.random() < 0.3 ? BEAT / 2 : 0));
      }
      this.nextBeat += BEAT;
      this.beat += 1;
    }
  }

  private pad(freq: number, dur: number, when: number): void {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    for (const [mul, type, vol] of [[1, 'sine', 0.035], [2.003, 'triangle', 0.012]] as [number, OscillatorType, number][]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.music);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
  }

  private pluck(freq: number, when: number): void {
    if (!this.ctx || !this.music || !this.delay) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 2, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(g);
    g.connect(this.music);
    g.connect(this.delay);
    osc.start(t0);
    osc.stop(t0 + 1.0);
  }
}

export const sfx = new Sfx();
