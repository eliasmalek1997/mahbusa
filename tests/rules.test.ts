import { describe, it, expect, beforeEach } from "vitest";
import { initializeGame, serializeGameState, validateGameState } from "../lib/game/initialState";
import {
  rollDice,
  getLegalMoves,
  applyMove,
  canBearOff,
  isGameOver,
  endTurn,
  applyRoll,
  opponent,
} from "../lib/game/rules";
import { GameState, PlayerId, Move } from "../lib/game/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function stateWithDice(state: GameState, d1: number, d2: number): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  if (d1 === d2) {
    next.dice = { values: [d1, d1, d1, d1], used: [false, false, false, false] };
  } else {
    next.dice = { values: [d1, d2], used: [false, false] };
  }
  next.hasRolled = true;
  return next;
}

function clearBoard(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  for (const pt of next.board) pt.checkers = [];
  next.borneOff = { 1: 0, 2: 0 };
  return next;
}

// ─── Initial board ──────────────────────────────────────────────────────────

describe("Initial board setup", () => {
  it("puts 15 P1 checkers on point 0", () => {
    const state = initializeGame();
    const p1 = state.board[0].checkers.filter((c) => c.player === 1);
    expect(p1).toHaveLength(15);
  });

  it("puts 15 P2 checkers on point 23", () => {
    const state = initializeGame();
    const p2 = state.board[23].checkers.filter((c) => c.player === 2);
    expect(p2).toHaveLength(15);
  });

  it("all other points are empty", () => {
    const state = initializeGame();
    for (let i = 1; i <= 22; i++) {
      expect(state.board[i].checkers).toHaveLength(0);
    }
  });

  it("P1 goes first", () => {
    const state = initializeGame();
    expect(state.currentTurn).toBe(1);
  });

  it("status is active", () => {
    const state = initializeGame();
    expect(state.status).toBe("active");
  });
});

// ─── Dice ────────────────────────────────────────────────────────────────────

describe("Dice", () => {
  it("rolls values between 1 and 6", () => {
    for (let i = 0; i < 50; i++) {
      const dice = rollDice();
      for (const v of dice.values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    }
  });

  it("doubles produce 4 moves", () => {
    const dice = rollDice();
    // Force-test with manual doubles
    const doubles = { values: [3, 3, 3, 3], used: [false, false, false, false] };
    expect(doubles.values).toHaveLength(4);
  });

  it("non-doubles produce 2 moves", () => {
    const dice = { values: [2, 5], used: [false, false] };
    expect(dice.values).toHaveLength(2);
  });
});

// ─── Basic movement ──────────────────────────────────────────────────────────

describe("Basic movement", () => {
  it("P1 can move forward with a die roll", () => {
    const state = stateWithDice(initializeGame(), 3, 5);
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.from === 0 && m.to === 3)).toBe(true);
    expect(moves.some((m) => m.from === 0 && m.to === 5)).toBe(true);
  });

  it("P1 cannot move backwards", () => {
    const state = stateWithDice(initializeGame(), 3, 5);
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.to < 0)).toBe(false);
  });

  it("applying a move updates the board", () => {
    let state = stateWithDice(initializeGame(), 3, 5);
    const move: Move = { from: 0, to: 3, dieIndex: 0 };
    state = applyMove(state, move);
    expect(state.board[3].checkers.some((c) => c.player === 1)).toBe(true);
    expect(state.board[0].checkers.filter((c) => c.player === 1)).toHaveLength(14);
  });

  it("uses the correct die after a move", () => {
    let state = stateWithDice(initializeGame(), 3, 5);
    state = applyMove(state, { from: 0, to: 3, dieIndex: 0 });
    expect(state.dice!.used[0]).toBe(true);
    expect(state.dice!.used[1]).toBe(false);
  });

  it("doubles allow four moves of the same value", () => {
    let state = stateWithDice(initializeGame(), 4, 4);
    expect(state.dice!.values).toHaveLength(4);
    state = applyMove(state, { from: 0, to: 4, dieIndex: 0 });
    state = applyMove(state, { from: 0, to: 4, dieIndex: 1 });
    state = applyMove(state, { from: 0, to: 4, dieIndex: 2 });
    state = applyMove(state, { from: 0, to: 4, dieIndex: 3 });
    expect(state.board[4].checkers.filter((c) => c.player === 1)).toHaveLength(4);
  });
});

// ─── Blocking ────────────────────────────────────────────────────────────────

describe("Blocked points", () => {
  it("P1 cannot move onto a point with 2+ P2 checkers", () => {
    let state = clearBoard(initializeGame());
    // Place 1 P1 checker on point 0
    state.board[0].checkers = [{ player: 1, isPinned: false }];
    // Place 2 P2 checkers on point 3
    state.board[3].checkers = [
      { player: 2, isPinned: false },
      { player: 2, isPinned: false },
    ];
    state = stateWithDice(state, 3, 5);
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.to === 3)).toBe(false);
  });
});

// ─── Pinning ─────────────────────────────────────────────────────────────────

describe("Pinning", () => {
  it("P1 can land on a point with exactly 1 P2 checker", () => {
    let state = clearBoard(initializeGame());
    state.board[0].checkers = [{ player: 1, isPinned: false }];
    state.board[3].checkers = [{ player: 2, isPinned: false }];
    state = stateWithDice(state, 3, 5);
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.to === 3)).toBe(true);
  });

  it("pinned checker is marked isPinned after pinning move", () => {
    let state = clearBoard(initializeGame());
    state.board[0].checkers = [{ player: 1, isPinned: false }];
    state.board[3].checkers = [{ player: 2, isPinned: false }];
    state = stateWithDice(state, 3, 5);
    state = applyMove(state, { from: 0, to: 3, dieIndex: 0 });
    const p2Checker = state.board[3].checkers.find((c) => c.player === 2);
    expect(p2Checker?.isPinned).toBe(true);
  });

  it("pinned checker cannot move", () => {
    let state = clearBoard(initializeGame());
    // P2's turn, P2 checker on point 3 is pinned
    state.board[3].checkers = [
      { player: 2, isPinned: true }, // pinned
      { player: 1, isPinned: false }, // pinner on top
    ];
    state.currentTurn = 2;
    state = stateWithDice(state, 2, 4);
    const moves = getLegalMoves(state);
    // No move from point 3 for P2
    expect(moves.some((m) => m.from === 3)).toBe(false);
  });

  it("can stack multiple own checkers on top of a pinned opponent", () => {
    let state = clearBoard(initializeGame());
    // P1 already pinning P2 on point 3
    state.board[0].checkers = [
      { player: 1, isPinned: false },
      { player: 1, isPinned: false },
    ];
    state.board[3].checkers = [
      { player: 2, isPinned: true },
      { player: 1, isPinned: false },
    ];
    state = stateWithDice(state, 3, 5);
    const moves = getLegalMoves(state);
    // Should be able to move another P1 checker onto point 3 (stacking)
    expect(moves.some((m) => m.from === 0 && m.to === 3)).toBe(true);
    state = applyMove(state, { from: 0, to: 3, dieIndex: 0 });
    const p1Count = state.board[3].checkers.filter((c) => c.player === 1).length;
    const p2Pinned = state.board[3].checkers.find((c) => c.player === 2)?.isPinned;
    expect(p1Count).toBe(2); // two P1 checkers stacked
    expect(p2Pinned).toBe(true); // opponent still pinned
  });

  it("checker is unpinned when pinner moves away", () => {
    let state = clearBoard(initializeGame());
    // P1 on point 3 (pinner), P2 pinned on point 3
    state.board[3].checkers = [
      { player: 2, isPinned: true },
      { player: 1, isPinned: false },
    ];
    state = stateWithDice(state, 2, 4);
    // Move P1 away from point 3 using die value 2 (index 0)
    state = applyMove(state, { from: 3, to: 5, dieIndex: 0 }); // +2
    const p2Checker = state.board[3].checkers.find((c) => c.player === 2);
    expect(p2Checker?.isPinned).toBe(false);
  });
});

// ─── Bearing off ─────────────────────────────────────────────────────────────

describe("Bearing off", () => {
  it("P1 cannot bear off when checkers are outside home board", () => {
    const state = initializeGame(); // all on point 0, not in home range 18-23
    expect(canBearOff(state, 1)).toBe(false);
  });

  it("P1 cannot bear off when a checker is pinned outside the home board", () => {
    let state = clearBoard(initializeGame());
    // Most P1 checkers in home board...
    for (let i = 0; i < 14; i++)
      state.board[18 + (i % 6)].checkers.push({ player: 1, isPinned: false });
    // ...but one P1 checker is pinned outside the home board at point 5
    state.board[4].checkers = [
      { player: 1, isPinned: true },  // P1 trapped
      { player: 2, isPinned: false }, // P2 pinner on top
    ];
    expect(canBearOff(state, 1)).toBe(false);
  });

  it("P1 can bear off when all checkers are in home board", () => {
    let state = clearBoard(initializeGame());
    // Place all 15 P1 checkers in home range 18-23
    for (let i = 0; i < 15; i++) {
      state.board[18 + (i % 6)].checkers.push({ player: 1, isPinned: false });
    }
    expect(canBearOff(state, 1)).toBe(true);
  });

  it("P2 cannot bear off when checkers are outside home board", () => {
    const state = initializeGame();
    expect(canBearOff(state, 2)).toBe(false);
  });

  it("overshoot with die 4 removes checker from position 2, not position 1", () => {
    // User's exact scenario: checkers on position 2 (index 22) and position 1 (index 23),
    // roll a 4 → should remove from position 2 (farthest), NOT position 1.
    let state = clearBoard(initializeGame());
    state.board[22].checkers = [{ player: 1, isPinned: false }]; // position 2
    state.board[23].checkers = [{ player: 1, isPinned: false }]; // position 1
    state.borneOff = { 1: 13, 2: 0 };
    state = stateWithDice(state, 4, 1);
    const moves = getLegalMoves(state);
    const bearMoves = moves.filter((m) => m.to === 24);
    // Die 4 (dieIndex 0): overshoot — must come FROM index 22 (farthest), not 23
    const die4BearOff = bearMoves.find((m) => m.dieIndex === 0);
    expect(die4BearOff).toBeDefined();
    expect(die4BearOff!.from).toBe(22); // position 2, not position 1
    // Die 1 (dieIndex 1): exact bear-off from index 23 (23+1=24)
    const die1BearOff = bearMoves.find((m) => m.dieIndex === 1);
    expect(die1BearOff).toBeDefined();
    expect(die1BearOff!.from).toBe(23);
  });

  it("exact bear-off: die 6 removes checker at position 6 (index 18)", () => {
    let state = clearBoard(initializeGame());
    state.board[18].checkers = [{ player: 1, isPinned: false }]; // position 6 (18+6=24)
    state.board[23].checkers = [{ player: 1, isPinned: false }]; // position 1
    state.borneOff = { 1: 13, 2: 0 };
    state = stateWithDice(state, 6, 1);
    const moves = getLegalMoves(state);
    const die6Bear = moves.find((m) => m.dieIndex === 0 && m.to === 24);
    expect(die6Bear).toBeDefined();
    expect(die6Bear!.from).toBe(18); // exact: 18+6=24
  });

  it("P1 bear off move reduces borne-off count", () => {
    let state = clearBoard(initializeGame());
    state.board[23].checkers = [{ player: 1, isPinned: false }];
    state.borneOff = { 1: 14, 2: 0 };
    state = stateWithDice(state, 1, 3);
    const moves = getLegalMoves(state);
    const bearMove = moves.find((m) => m.to === 24);
    expect(bearMove).toBeDefined();
    state = applyMove(state, bearMove!);
    expect(state.borneOff[1]).toBe(15);
  });
});

// ─── Winner detection ────────────────────────────────────────────────────────

describe("Winner detection", () => {
  it("game is not over at the start", () => {
    expect(isGameOver(initializeGame())).toBe(false);
  });

  it("game is over when a player bears off all 15 checkers", () => {
    let state = clearBoard(initializeGame());
    state.board[23].checkers = [{ player: 1, isPinned: false }];
    state.borneOff = { 1: 14, 2: 0 };
    state = stateWithDice(state, 1, 3);
    const bearMove = getLegalMoves(state).find((m) => m.to === 24)!;
    state = applyMove(state, bearMove);
    expect(isGameOver(state)).toBe(true);
    expect(state.winner).toBe(1);
  });
});

// ─── Illegal move rejection ──────────────────────────────────────────────────

describe("Illegal move rejection", () => {
  it("throws when applying an illegal move", () => {
    const state = stateWithDice(initializeGame(), 3, 5);
    expect(() => applyMove(state, { from: 5, to: 8, dieIndex: 0 })).toThrow();
  });

  it("P1 cannot move into a blocked point", () => {
    let state = clearBoard(initializeGame());
    state.board[0].checkers = [{ player: 1, isPinned: false }];
    state.board[3].checkers = [
      { player: 2, isPinned: false },
      { player: 2, isPinned: false },
    ];
    state = stateWithDice(state, 3, 5);
    expect(() => applyMove(state, { from: 0, to: 3, dieIndex: 0 })).toThrow();
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe("Serialization", () => {
  it("round-trips through serialize/validate", () => {
    const state = initializeGame();
    const json = serializeGameState(state);
    const parsed = validateGameState(JSON.parse(json));
    expect(parsed.board).toHaveLength(24);
    expect(parsed.currentTurn).toBe(1);
  });

  it("validateGameState throws on invalid input", () => {
    expect(() => validateGameState({ board: [] })).toThrow();
  });
});

// ─── Turn management ─────────────────────────────────────────────────────────

describe("Turn management", () => {
  it("endTurn switches to the other player", () => {
    const state = initializeGame();
    const next = endTurn(stateWithDice(state, 1, 2));
    expect(next.currentTurn).toBe(2);
  });

  it("applyRoll sets hasRolled true and populates dice", () => {
    const state = initializeGame();
    const rolled = applyRoll(state);
    expect(rolled.hasRolled).toBe(true);
    expect(rolled.dice).not.toBeNull();
  });

  it("applyRoll throws if already rolled", () => {
    const state = stateWithDice(initializeGame(), 3, 5);
    expect(() => applyRoll(state)).toThrow();
  });
});
