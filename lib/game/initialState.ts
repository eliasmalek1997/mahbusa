import { GameState, PlayerId, Point, PLAYER_START_POINT } from "./types";

function emptyPoint(): Point {
  return { checkers: [] };
}

export function initializeGame(): GameState {
  const board: Point[] = Array.from({ length: 24 }, emptyPoint);

  // Player 1: all 15 checkers on point 0
  for (let i = 0; i < 15; i++) {
    board[PLAYER_START_POINT[1]].checkers.push({ player: 1, isPinned: false });
  }

  // Player 2: all 15 checkers on point 23
  for (let i = 0; i < 15; i++) {
    board[PLAYER_START_POINT[2]].checkers.push({ player: 2, isPinned: false });
  }

  return {
    board,
    currentTurn: 1,
    dice: null,
    hasRolled: false,
    borneOff: { 1: 0, 2: 0 },
    status: "active",
    winner: null,
    moveHistory: [],
  };
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function validateGameState(raw: unknown): GameState {
  const s = raw as GameState;
  if (!s || !Array.isArray(s.board) || s.board.length !== 24) {
    throw new Error("Invalid game state: board missing or wrong length");
  }
  if (s.currentTurn !== 1 && s.currentTurn !== 2) {
    throw new Error("Invalid game state: currentTurn must be 1 or 2");
  }
  return s;
}
