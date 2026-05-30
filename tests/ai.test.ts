import { describe, it, expect } from "vitest";
import { pickBestMove } from "../lib/game/ai";
import { GameState } from "../lib/game/types";

function base(overrides?: Partial<GameState>): GameState {
  return {
    board: Array.from({ length: 24 }, () => ({ checkers: [] })),
    currentTurn: 1,
    dice: null,
    hasRolled: false,
    borneOff: { 1: 0, 2: 0 },
    status: "active",
    winner: null,
    moveHistory: [],
    ...overrides,
  };
}

function withDice(s: GameState, d1: number, d2: number): GameState {
  return {
    ...s,
    dice: d1 === d2
      ? { values: [d1, d1, d1, d1], used: [false, false, false, false] }
      : { values: [d1, d2], used: [false, false] },
    hasRolled: true,
  };
}

describe("AI strategy", () => {
  it("prefers pinning a lone opponent over moving to an empty point", () => {
    const s = base();
    // P1 can either move to point 4 (empty) or point 5 (lone P2 = pin)
    s.board[0].checkers = [
      { player: 1, isPinned: false },
      { player: 1, isPinned: false },
    ];
    s.board[4].checkers = [{ player: 2, isPinned: false }]; // lone P2 — pinnable
    const state = withDice(s, 4, 6);
    const move = pickBestMove(state);
    // Die 4 (dieIndex 0): from 0 → 4, pins P2. Should prefer this.
    expect(move).not.toBeNull();
    expect(move!.to).toBe(4);
  });

  it("prefers joining own checker to build a block over moving to empty", () => {
    const s = base();
    s.board[0].checkers = [
      { player: 1, isPinned: false },
      { player: 1, isPinned: false },
    ];
    s.board[3].checkers = [{ player: 1, isPinned: false }]; // our own single — joining creates block
    // die 3 → to 3 (join our single = block), die 5 → to 5 (empty)
    const state = withDice(s, 3, 5);
    const move = pickBestMove(state);
    expect(move!.to).toBe(3); // prefer building the block
  });

  it("prefers bearing off over any board move", () => {
    const s = base();
    // All checkers in home board, can bear off
    s.board[23].checkers = [{ player: 1, isPinned: false }];
    s.board[18].checkers = [{ player: 1, isPinned: false }];
    s.borneOff = { 1: 13, 2: 0 };
    // die 1 from 23 = exact bear off; die 5 from 18 = exact bear off
    const state = withDice(s, 1, 5);
    const move = pickBestMove(state);
    expect(move!.to).toBe(24);
  });

  it("avoids leaving a single checker vulnerable when better options exist", () => {
    const s = base();
    // P1 has 2 checkers on point 0 and 1 checker on point 10
    s.board[0].checkers = [
      { player: 1, isPinned: false },
      { player: 1, isPinned: false },
    ];
    s.board[9].checkers = [{ player: 1, isPinned: false }]; // lone checker

    s.board[12].checkers = [{ player: 1, isPinned: false }]; // another single
    // die 3: from 0→3 (leaves 1 at 0, safe) OR from 9→12 (joins 12, makes block)
    const state = withDice(s, 3, 5);
    const move = pickBestMove(state);
    // Joining the single at 12 is better (makes a block)
    expect(move!.to).toBe(12);
  });
});
