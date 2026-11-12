// Daily trial: a deterministic board seed and three goals derived from the calendar day,
// so every player gets the same challenge on the same date.
import { seededRandom } from './Engine';
import { dayKey } from './Progress';

export type GoalKind = 'tile' | 'score' | 'combo' | 'pure';

export interface Goal {
  kind: GoalKind;
  target: number;
  label: string;
  /** compact label for the in-game strip */
  short: string;
}

/** What the goals are judged against; GameScene keeps this up to date during a daily game. */
export interface GoalProgress {
  maxTile: number;
  score: number;
  bestCombo: number;
  boostersUsed: boolean;
}

export function daySeed(key = dayKey()): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyGoals(key = dayKey()): Goal[] {
  const rnd = seededRandom(daySeed(key) ^ 0x9e3779b9);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const tile = pick([256, 256, 512, 512, 1024]);
  const score = pick([2000, 3000, 4000, 6000, 8000]);
  let third: Goal;
  if (rnd() < 0.5) {
    const n = pick([3, 3, 4]);
    third = { kind: 'combo', target: n, label: `Merge ${n} gems in one swipe`, short: `COMBO x${n}` };
  } else {
    const t = pick([128, 256]);
    third = { kind: 'pure', target: t, label: `Forge ${t} without boosters`, short: `PURE ${t}` };
  }

  return [
    { kind: 'tile', target: tile, label: `Forge the ${tile} gem`, short: `GEM ${tile}` },
    { kind: 'score', target: score, label: `Score ${score.toLocaleString('en-US')} points`, short: `${score} PTS` },
    third,
  ];
}

export function evalGoals(goals: Goal[], p: GoalProgress): boolean[] {
  return goals.map((g) => {
    switch (g.kind) {
      case 'tile': return p.maxTile >= g.target;
      case 'score': return p.score >= g.target;
      case 'combo': return p.bestCombo >= g.target;
      case 'pure': return p.maxTile >= g.target && !p.boostersUsed;
    }
  });
}

/** Human date for the daily screen, e.g. "Thursday, 12 Nov". */
export function prettyDay(key = dayKey()): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
