export type PlayerId = 1 | 2;

export interface Checker {
  player: PlayerId;
  isPinned: boolean; // true if this checker is pinned by an opponent
}

export interface Point {
  checkers: Checker[];
}

export interface DiceRoll {
  values: number[]; // 2 values for normal, 4 for doubles
  used: boolean[];
}

export interface Move {
  from: number; // 0-23 for board points, 24 = bear-off source (home), -1 = off-board entry
  to: number;   // 0-23 for board points, 24 = bear off
  dieIndex: number; // which die from dice.used[] is consumed
}

export interface GameState {
  board: Point[];        // 24 points, index 0..23
  currentTurn: PlayerId;
  dice: DiceRoll | null;
  hasRolled: boolean;
  borneOff: Record<PlayerId, number>; // how many checkers borne off
  status: "waiting" | "active" | "complete";
  winner: PlayerId | null;
  moveHistory: string[];
}

export interface GameRecord {
  id: string;
  room_code: string;
  status: "waiting" | "active" | "complete";
  player1_name: string;
  player2_name: string;
  current_turn: PlayerId;
  game_state: GameState;
  winner: PlayerId | null;
  created_at: string;
  updated_at: string;
}

export interface RoomRecord {
  room_code: string;
  player1_name: string;
  player2_name: string;
  wins_p1: number;
  wins_p2: number;
  score_p1: number; // cumulative match score toward 31
  score_p2: number;
  created_at: string;
  updated_at: string;
}

// Persian dice names used in Lebanese/Syrian Tawleh (Mahbusa)
export const DICE_NAMES: Record<number, string> = {
  1: "Yak",
  2: "Do",
  3: "Se",
  4: "Char",
  5: "Penj",
  6: "Shesh",
};

export const RULESET = {
  variantName: "Lebanese Mahbusa",
  startingMode: "all_on_start_point" as const,
  targetScore: 31,
  allowDoublingCube: false,
  allowPinning: true,
  allowHitting: false,
} as const;

// Player 1 moves from point 0 → 23 (bear off at 24)
// Player 2 moves from point 23 → 0 (bear off at -1, stored as 24)
export const PLAYER_DIRECTION: Record<PlayerId, 1 | -1> = {
  1: 1,
  2: -1,
};

export const PLAYER_START_POINT: Record<PlayerId, number> = {
  1: 0,   // all 15 checkers start on point 0
  2: 23,  // all 15 checkers start on point 23
};

export const PLAYER_HOME_RANGE: Record<PlayerId, [number, number]> = {
  1: [18, 23], // home board for player 1
  2: [0, 5],   // home board for player 2
};
