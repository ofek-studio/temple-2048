// Game mode definitions. GameScene reads everything it needs from here.

export type ModeId = 'classic' | 'timed' | 'zen' | 'mini' | 'grand' | 'daily';

export interface Mode {
  id: ModeId;
  name: string;
  /** short line shown under the mode name */
  blurb: string;
  size: 3 | 4 | 5;
  winValue: number;
  /** seconds; undefined = untimed */
  timeLimit?: number;
  /** no game over: the board clears its smallest gems when stuck */
  zen?: boolean;
  boosters: { undos: number; hammers: number; shuffles: number };
  /** whether an unfinished game is saved and resumable */
  resumable: boolean;
}

export const MODES: Record<ModeId, Mode> = {
  classic: {
    id: 'classic',
    name: 'TEMPLE 2048',
    blurb: 'The classic 4 x 4 quest for the Sacred Gem',
    size: 4,
    winValue: 2048,
    boosters: { undos: 3, hammers: 1, shuffles: 1 },
    resumable: true,
  },
  timed: {
    id: 'timed',
    name: 'TIME ATTACK',
    blurb: '2 minutes. Score as much as you can',
    size: 4,
    winValue: 2048,
    timeLimit: 120,
    boosters: { undos: 1, hammers: 1, shuffles: 0 },
    resumable: false,
  },
  zen: {
    id: 'zen',
    name: 'ZEN GARDEN',
    blurb: 'No game over. The temple makes room for you',
    size: 4,
    winValue: 2048,
    zen: true,
    boosters: { undos: 99, hammers: 3, shuffles: 3 },
    resumable: true,
  },
  mini: {
    id: 'mini',
    name: 'MINI 3 x 3',
    blurb: 'Tiny board, brutal choices. Forge 256',
    size: 3,
    winValue: 256,
    boosters: { undos: 3, hammers: 1, shuffles: 1 },
    resumable: true,
  },
  grand: {
    id: 'grand',
    name: 'GRAND 5 x 5',
    blurb: 'Room to breathe. Forge 4096',
    size: 5,
    winValue: 4096,
    boosters: { undos: 3, hammers: 1, shuffles: 1 },
    resumable: true,
  },
  daily: {
    id: 'daily',
    name: 'DAILY TRIAL',
    blurb: 'Same board for everyone, three goals, new every day',
    size: 4,
    winValue: 2048,
    boosters: { undos: 1, hammers: 1, shuffles: 0 },
    resumable: true,
  },
};

/** Modes listed on the "modes" screen (daily has its own screen). */
export const PICKABLE_MODES: ModeId[] = ['classic', 'timed', 'zen', 'mini', 'grand'];
