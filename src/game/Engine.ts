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
}

export const SIZE = 4;
export const WIN_VALUE = 2048;

export class Engine {
  grid: (Tile | null)[][] = [];
  score = 0;
  best = 0;
  /** set once the player reached WIN_VALUE (they may keep playing) */
  won = false;
  private nextId = 1;
  private history: { grid: (number | null)[][]; score: number } | null = null;
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.reset();
  }

  reset(): void {
    this.grid = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
    this.score = 0;
    this.won = false;
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

  loadValues(values: (number | null)[][]): void {
    this.grid = values.map((row, r) =>
      row.map((v, c) => (v ? { id: this.nextId++, value: v, r, c } : null)),
    );
  }

  save(): SaveState {
    return { grid: this.values(), score: this.score, best: this.best, won: this.won };
  }

  load(s: SaveState): void {
    this.loadValues(s.grid);
    this.score = s.score;
    this.best = s.best;
    this.won = s.won;
    this.history = null;
  }

  canUndo(): boolean {
    return this.history !== null;
  }

  undo(): boolean {
    if (!this.history) return false;
    this.loadValues(this.history.grid);
    this.score = this.history.score;
    this.history = null;
    return true;
  }

  emptyCells(): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (!this.grid[r][c]) cells.push([r, c]);
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

  /** True when no move changes the board. */
  isGameOver(): boolean {
    if (this.emptyCells().length > 0) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = this.grid[r][c]!.value;
        if (r + 1 < SIZE && this.grid[r + 1][c]!.value === v) return false;
        if (c + 1 < SIZE && this.grid[r][c + 1]!.value === v) return false;
      }
    }
    return true;
  }

  move(dir: Dir): MoveResult {
    const result: MoveResult = { moved: false, moves: [], merges: [], spawned: null, scoreGain: 0 };
    const before = { grid: this.values(), score: this.score };

    const newGrid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
      Array<Tile | null>(SIZE).fill(null),
    );

    // Each "line" is a list of cells in traversal order (the first cell is where tiles pile up).
    for (let i = 0; i < SIZE; i++) {
      const cells: [number, number][] = [];
      for (let k = 0; k < SIZE; k++) {
        switch (dir) {
          case 'left': cells.push([i, k]); break;
          case 'right': cells.push([i, SIZE - 1 - k]); break;
          case 'up': cells.push([k, i]); break;
          case 'down': cells.push([SIZE - 1 - k, i]); break;
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
          if (merged.value >= WIN_VALUE) this.won = true;
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
    result.spawned = this.spawn();
    return result;
  }
}
