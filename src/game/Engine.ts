// Pure 2048 game logic. No rendering here, so it is easy to test and reuse.

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
}

export interface TileMove {
  id: number;
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  /** true when this tile is consumed by a merge at its destination */
  consumed: boolean;
}

export interface Merge {
  /** the newly created tile */
  tile: Tile;
  fromIds: [number, number];
}

export interface MoveResult {
  moved: boolean;
  moves: TileMove[];
  merges: Merge[];
  spawned: Tile | null;
  scoreGain: number;
}

export interface SaveState {
  grid: (number | null)[][]; // values only
  score: number;
  best: number;
  won: boolean;
  /** booster charges left in this game (older saves lack these fields) */
  undos?: number;
  hammers?: number;
  shuffles?: number;
  moveCount?: number;
  /** seconds left (timed mode) */
  timeLeft?: number;
  /** elapsed play seconds in this game */
  elapsed?: number;
  /** daily challenge day key, so a stale daily save is not resumed on another day */
  dayKey?: string;
  /** daily goal bookkeeping */
  bestCombo?: number;
  boostersUsed?: boolean;
  /** whether this was a fresh game whose stats were already counted */
  counted?: boolean;
}

export const SIZE = 4;
export const WIN_VALUE = 2048;

/** Deterministic PRNG (mulberry32) so a daily board is the same for everyone. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Engine {
  grid: (Tile | null)[][] = [];
  score = 0;
  best = 0;
  /** set once the player reached winValue (they may keep playing) */
  won = false;
  moveCount = 0;
  /** booster charges */
  undos = 3;
  hammers = 1;
  shuffles = 1;
  private nextId = 1;
  private history: { grid: (number | null)[][]; score: number } | null = null;
  private rng: () => number;

  constructor(
    rng: () => number = Math.random,
    public readonly size = SIZE,
    public readonly winValue = WIN_VALUE,
    private readonly boosters: { undos: number; hammers: number; shuffles: number } = { undos: 3, hammers: 1, shuffles: 1 },
  ) {
    this.rng = rng;
    this.reset();
  }

  reset(): void {
    this.grid = Array.from({ length: this.size }, () => Array<Tile | null>(this.size).fill(null));
    this.score = 0;
    this.won = false;
    this.moveCount = 0;
    this.undos = this.boosters.undos;
    this.hammers = this.boosters.hammers;
    this.shuffles = this.boosters.shuffles;
    this.history = null;
    this.spawn();
    this.spawn();
  }

  tiles(): Tile[] {
    const out: Tile[] = [];
    for (const row of this.grid) for (const t of row) if (t) out.push(t);
    return out;
  }

  values(): (number | null)[][] {
    return this.grid.map((row) => row.map((t) => (t ? t.value : null)));
  }

  /** Largest tile on the board. */
  maxTile(): number {
    let m = 0;
    for (const t of this.tiles()) if (t.value > m) m = t.value;
    return m;
  }

  loadValues(values: (number | null)[][]): void {
    this.grid = values.map((row, r) =>
      row.map((v, c) => (v ? { id: this.nextId++, value: v, r, c } : null)),
    );
  }

  save(): SaveState {
    return {
      grid: this.values(),
      score: this.score,
      best: this.best,
      won: this.won,
      undos: this.undos,
      hammers: this.hammers,
      shuffles: this.shuffles,
      moveCount: this.moveCount,
    };
  }

  load(s: SaveState): void {
    this.loadValues(s.grid);
    this.score = s.score;
    this.best = s.best;
    this.won = s.won;
    this.undos = s.undos ?? this.boosters.undos;
    this.hammers = s.hammers ?? this.boosters.hammers;
    this.shuffles = s.shuffles ?? this.boosters.shuffles;
    this.moveCount = s.moveCount ?? 0;
    this.history = null;
  }

  canUndo(): boolean {
    return this.history !== null && this.undos > 0;
  }

  undo(): boolean {
    if (!this.canUndo() || !this.history) return false;
    this.loadValues(this.history.grid);
    this.score = this.history.score;
    this.history = null;
    this.undos -= 1;
    return true;
  }

  /** Remove one tile (the "hammer" booster). Returns the removed tile. */
  hammer(r: number, c: number): Tile | null {
    if (this.hammers <= 0) return null;
    const t = this.grid[r]?.[c];
    if (!t) return null;
    this.grid[r][c] = null;
    this.hammers -= 1;
    this.history = null;
    return t;
  }

  /** Reposition every tile randomly (the "shuffle" booster). */
  shuffle(): boolean {
    if (this.shuffles <= 0) return false;
    const tiles = this.tiles();
    const cells: [number, number][] = [];
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    this.grid = Array.from({ length: this.size }, () => Array<Tile | null>(this.size).fill(null));
    tiles.forEach((t, i) => {
      const [r, c] = cells[i];
      this.grid[r][c] = { ...t, r, c };
    });
    this.shuffles -= 1;
    this.history = null;
    return true;
  }

  emptyCells(): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (!this.grid[r][c]) cells.push([r, c]);
    return cells;
  }

  spawn(): Tile | null {
    const empty = this.emptyCells();
    if (empty.length === 0) return null;
    const [r, c] = empty[Math.floor(this.rng() * empty.length)];
    const tile: Tile = { id: this.nextId++, value: this.rng() < 0.9 ? 2 : 4, r, c };
    this.grid[r][c] = tile;
    return tile;
  }

  /** Zen mode relief: clear the smallest tiles so play can continue. Returns removed tiles. */
  clearSmallest(): Tile[] {
    const tiles = this.tiles();
    if (tiles.length === 0) return [];
    const min = Math.min(...tiles.map((t) => t.value));
    const removed = tiles.filter((t) => t.value === min || t.value === min * 2);
    for (const t of removed) this.grid[t.r][t.c] = null;
    this.history = null;
    return removed;
  }

  /** True when no move changes the board. */
  isGameOver(): boolean {
    if (this.emptyCells().length > 0) return false;
    const n = this.size;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = this.grid[r][c]!.value;
        if (r + 1 < n && this.grid[r + 1][c]!.value === v) return false;
        if (c + 1 < n && this.grid[r][c + 1]!.value === v) return false;
      }
    }
    return true;
  }

  move(dir: Dir): MoveResult {
    const result: MoveResult = { moved: false, moves: [], merges: [], spawned: null, scoreGain: 0 };
    const before = { grid: this.values(), score: this.score };
    const n = this.size;

    const newGrid: (Tile | null)[][] = Array.from({ length: n }, () => Array<Tile | null>(n).fill(null));

    // Each "line" is a list of cells in traversal order (the first cell is where tiles pile up).
    for (let i = 0; i < n; i++) {
      const cells: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        switch (dir) {
          case 'left': cells.push([i, k]); break;
          case 'right': cells.push([i, n - 1 - k]); break;
          case 'up': cells.push([k, i]); break;
          case 'down': cells.push([n - 1 - k, i]); break;
        }
      }

      const line = cells.map(([r, c]) => this.grid[r][c]).filter((t): t is Tile => t !== null);
      const placed: { tile: Tile; merged: boolean; srcId: number }[] = [];

      for (const tile of line) {
        const last = placed[placed.length - 1];
        if (last && !last.merged && last.tile.value === tile.value) {
          const [tr, tc] = cells[placed.length - 1];
          const merged: Tile = { id: this.nextId++, value: tile.value * 2, r: tr, c: tc };
          result.moves.push({ id: tile.id, fromR: tile.r, fromC: tile.c, toR: tr, toC: tc, consumed: true });
          const prevMove = result.moves.find((m) => m.id === last.srcId);
          if (prevMove) prevMove.consumed = true;
          result.merges.push({ tile: merged, fromIds: [last.srcId, tile.id] });
          result.scoreGain += merged.value;
          if (merged.value >= this.winValue) this.won = true;
          placed[placed.length - 1] = { tile: merged, merged: true, srcId: merged.id };
          result.moved = true;
        } else {
          const [tr, tc] = cells[placed.length];
          result.moves.push({ id: tile.id, fromR: tile.r, fromC: tile.c, toR: tr, toC: tc, consumed: false });
          if (tr !== tile.r || tc !== tile.c) result.moved = true;
          placed.push({ tile: { ...tile, r: tr, c: tc }, merged: false, srcId: tile.id });
        }
      }

      placed.forEach((p, k) => {
        const [r, c] = cells[k];
        newGrid[r][c] = { ...p.tile, r, c };
      });
    }

    if (!result.moved) return result;

    this.grid = newGrid;
    this.score += result.scoreGain;
    if (this.score > this.best) this.best = this.score;
    this.history = before;
    this.moveCount += 1;
    result.spawned = this.spawn();
    return result;
  }
}
