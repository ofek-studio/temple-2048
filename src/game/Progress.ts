// Persistent player progress: per-mode saves and bests, lifetime stats, daily streak,
// daily trial results and the gem gallery unlocks. Everything lives in localStorage.
import type { SaveState } from './Engine';
import type { ModeId } from './Modes';

const SAVE_KEY = 'temple2048:save'; // classic save (legacy key kept so old games resume)
const BEST_KEY = 'temple2048:best'; // classic best (legacy)
const PROGRESS_KEY = 'temple2048:progress';

export interface Stats {
  games: number;
  moves: number;
  merges: number;
  playSeconds: number;
  /** games in which the mode's win gem was forged */
  wins: number;
  highestTile: number;
  totalScore: number;
  bestCombo: number;
}

export interface DailyResult {
  stars: number;
  score: number;
  goals: boolean[];
}

export interface ProgressData {
  stats: Stats;
  /** gem value -> day key when it was first forged */
  unlocked: Record<string, string>;
  lastPlayDay: string | null;
  streak: number;
  bestStreak: number;
  daily: Record<string, DailyResult>;
  tutorialDone: boolean;
  best: Partial<Record<ModeId, number>>;
}

const EMPTY: ProgressData = {
  stats: { games: 0, moves: 0, merges: 0, playSeconds: 0, wins: 0, highestTile: 0, totalScore: 0, bestCombo: 0 },
  unlocked: {},
  lastPlayDay: null,
  streak: 0,
  bestStreak: 0,
  daily: {},
  tutorialDone: false,
  best: {},
};

function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setItem(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

class Progress {
  data: ProgressData;
  private dirty = false;

  constructor() {
    const raw = getItem(PROGRESS_KEY);
    let parsed: Partial<ProgressData> = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as Partial<ProgressData>;
      } catch {
        parsed = {};
      }
    }
    this.data = {
      ...EMPTY,
      ...parsed,
      stats: { ...EMPTY.stats, ...(parsed.stats ?? {}) },
      unlocked: { ...(parsed.unlocked ?? {}) },
      daily: { ...(parsed.daily ?? {}) },
      best: { ...(parsed.best ?? {}) },
    };
    // a streak that was not continued yesterday or today is broken
    const today = dayKey();
    const last = this.data.lastPlayDay;
    if (last && last !== today && last !== shiftDay(today, -1)) this.data.streak = 0;
  }

  save(): void {
    setItem(PROGRESS_KEY, JSON.stringify(this.data));
    this.dirty = false;
  }

  /** Call whenever the player makes a move. Keeps the daily streak alive. Returns true on a new streak day. */
  touchDay(): boolean {
    const today = dayKey();
    if (this.data.lastPlayDay === today) return false;
    const yesterday = shiftDay(today, -1);
    this.data.streak = this.data.lastPlayDay === yesterday ? this.data.streak + 1 : 1;
    this.data.bestStreak = Math.max(this.data.bestStreak, this.data.streak);
    this.data.lastPlayDay = today;
    this.save();
    return true;
  }

  /** Whether the player already played today (streak safe). */
  playedToday(): boolean {
    return this.data.lastPlayDay === dayKey();
  }

  // ---------- stats ----------
  recordMove(merges: number, mergedValues: number[]): number[] {
    const s = this.data.stats;
    s.moves += 1;
    s.merges += merges;
    if (merges > s.bestCombo) s.bestCombo = merges;
    const newly: number[] = [];
    for (const v of mergedValues) {
      if (v > s.highestTile) s.highestTile = v;
      const k = String(v);
      if (!this.data.unlocked[k]) {
        this.data.unlocked[k] = dayKey();
        newly.push(v);
      }
    }
    this.dirty = true;
    if (newly.length || s.moves % 5 === 0) this.save();
    return newly;
  }

  recordGameStart(): void {
    this.data.stats.games += 1;
    this.save();
  }

  recordGameEnd(score: number, won: boolean): void {
    this.data.stats.totalScore += score;
    if (won) this.data.stats.wins += 1;
    this.save();
  }

  tickPlay(seconds: number): void {
    this.data.stats.playSeconds += seconds;
    if (this.data.stats.playSeconds % 15 === 0) this.save();
  }

  isUnlocked(value: number): boolean {
    return !!this.data.unlocked[String(value)];
  }

  // ---------- bests ----------
  bestFor(mode: ModeId): number {
    if (mode === 'classic') {
      const legacy = Number(getItem(BEST_KEY) ?? 0) || 0;
      return Math.max(legacy, this.data.best.classic ?? 0);
    }
    return this.data.best[mode] ?? 0;
  }

  setBest(mode: ModeId, n: number): void {
    if (n <= this.bestFor(mode)) return;
    this.data.best[mode] = n;
    if (mode === 'classic') setItem(BEST_KEY, String(n));
    this.save();
  }

  // ---------- daily ----------
  dailyResult(key = dayKey()): DailyResult | null {
    return this.data.daily[key] ?? null;
  }

  /** Store a daily attempt, keeping the best stars and the best score. */
  recordDaily(key: string, result: DailyResult): DailyResult {
    const prev = this.data.daily[key];
    const merged: DailyResult = prev
      ? {
          stars: Math.max(prev.stars, result.stars),
          score: Math.max(prev.score, result.score),
          goals: result.goals.map((g, i) => g || !!prev.goals[i]),
        }
      : result;
    merged.stars = merged.goals.filter(Boolean).length;
    this.data.daily[key] = merged;
    this.save();
    return merged;
  }

  totalStars(): number {
    return Object.values(this.data.daily).reduce((a, d) => a + d.stars, 0);
  }

  // ---------- tutorial ----------
  finishTutorial(): void {
    this.data.tutorialDone = true;
    this.save();
  }

  flush(): void {
    if (this.dirty) this.save();
  }
}

export const progress = new Progress();

// ---------- per-mode game saves ----------
function saveKey(mode: ModeId): string {
  return mode === 'classic' ? SAVE_KEY : `${SAVE_KEY}:${mode}`;
}

export function loadSave(mode: ModeId, size: number): SaveState | null {
  const raw = getItem(saveKey(mode));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SaveState;
    if (!Array.isArray(s.grid) || s.grid.length !== size) return null;
    if (!s.grid.some((row) => row.some((v) => v !== null))) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(mode: ModeId, s: SaveState | null): void {
  setItem(saveKey(mode), s ? JSON.stringify(s) : null);
}
