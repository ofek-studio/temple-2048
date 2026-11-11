import type { SaveState } from './Engine';

const SAVE_KEY = 'temple2048:save';
const BEST_KEY = 'temple2048:best';

export function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    if (!Array.isArray(s.grid) || s.grid.length !== 4) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(s: SaveState | null): void {
  try {
    if (s) localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}
