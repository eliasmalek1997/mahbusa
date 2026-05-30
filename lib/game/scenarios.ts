import { GameState, PlayerId } from "./types";

function emptyBoard(): GameState["board"] {
  return Array.from({ length: 24 }, () => ({ checkers: [] }));
}

function base(): GameState {
  return {
    board: emptyBoard(),
    currentTurn: 1,
    dice: null,
    hasRolled: false,
    borneOff: { 1: 0, 2: 0 },
    status: "active",
    winner: null,
    moveHistory: [],
  };
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  state: GameState;
  /** Fixed dice for the first roll so the scenario is deterministic. */
  fixedDice?: [number, number];
}

export const SCENARIOS: Scenario[] = [
  // ── 1. Starting position ───────────────────────────────────────────────
  {
    id: "start",
    title: "Starting Position",
    description:
      "Default Mahbusa start. All 15 P1 checkers on point 1, all 15 P2 checkers on point 24. Roll dice and move.",
    fixedDice: [3, 5],
    state: (() => {
      const s = base();
      for (let i = 0; i < 15; i++) s.board[0].checkers.push({ player: 1, isPinned: false });
      for (let i = 0; i < 15; i++) s.board[23].checkers.push({ player: 2, isPinned: false });
      return s;
    })(),
  },

  // ── 2. Pinning & stacking ──────────────────────────────────────────────
  {
    id: "pin-stack",
    title: "Pin & Stack",
    description:
      "P1 has already pinned a P2 checker on point 10. P1 has two more checkers ready to stack on top. Roll 4+4 (doubles) to stack multiple times.",
    fixedDice: [4, 4],
    state: (() => {
      const s = base();
      // P1 source checkers
      s.board[5].checkers = [
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
      ];
      // Already-pinned point: P2 trapped, 1 P1 on top
      s.board[9].checkers = [
        { player: 2, isPinned: true },
        { player: 1, isPinned: false },
      ];
      // P2 has remaining checkers elsewhere
      s.board[23].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      s.board[20].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      s.moveHistory = ["P1 moves 6→10 (pins opponent)"];
      return s;
    })(),
  },

  // ── 3. Blocking ────────────────────────────────────────────────────────
  {
    id: "blocking",
    title: "Blocking",
    description:
      "P2 has built a wall: points 15, 16, 17 each have 2 checkers, blocking P1's path. P1 must route around. Roll a 3 to see blocked moves.",
    fixedDice: [3, 6],
    state: (() => {
      const s = base();
      s.board[0].checkers = [
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
      ];
      s.board[10].checkers = [
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
      ];
      // P2 wall at 14, 15, 16 (points 15-17)
      for (const pt of [14, 15, 16]) {
        s.board[pt].checkers = [
          { player: 2, isPinned: false },
          { player: 2, isPinned: false },
        ];
      }
      s.board[23].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      return s;
    })(),
  },

  // ── 4. Doubles ─────────────────────────────────────────────────────────
  {
    id: "doubles",
    title: "Doubles (4 Moves)",
    description:
      "P1 is set up to roll double 3s — four separate moves of 3 each. Watch all four dice slots get consumed one by one.",
    fixedDice: [3, 3],
    state: (() => {
      const s = base();
      for (let i = 0; i < 4; i++) s.board[0].checkers.push({ player: 1, isPinned: false });
      s.board[5].checkers = [
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
      ];
      s.board[23].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      return s;
    })(),
  },

  // ── 5. Bearing off ─────────────────────────────────────────────────────
  {
    id: "bear-off",
    title: "Bearing Off",
    description:
      "All P1 checkers are in the home board (points 19-24). P1 can start bearing off. Roll 5+6 to bear off two checkers.",
    fixedDice: [5, 6],
    state: (() => {
      const s = base();
      // Spread 15 P1 checkers across home board 18-23
      const pts = [18, 19, 20, 21, 22, 23];
      for (let i = 0; i < 15; i++)
        s.board[pts[i % 6]].checkers.push({ player: 1, isPinned: false });
      s.borneOff = { 1: 0, 2: 8 };
      s.board[1].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      return s;
    })(),
  },

  // ── 6. Near win ────────────────────────────────────────────────────────
  {
    id: "near-win",
    title: "Near Win",
    description:
      "P1 has 3 checkers left in their home board (positions 6, 5, 4). Fixed roll 6+5: die 6 removes the checker on position 6 exactly, die 5 removes position 5. Demonstrates exact bearing-off.",
    fixedDice: [6, 5],
    state: (() => {
      const s = base();
      // Position 6 of P1 home = index 18 (farthest; 18+6=24 = exact bear-off with die 6)
      // Position 5 of P1 home = index 19 (19+5=24 = exact bear-off with die 5)
      // Position 4 of P1 home = index 20
      s.board[18].checkers = [{ player: 1, isPinned: false }]; // position 6
      s.board[19].checkers = [{ player: 1, isPinned: false }]; // position 5
      s.board[20].checkers = [{ player: 1, isPinned: false }]; // position 4
      s.borneOff = { 1: 12, 2: 5 };
      s.board[1].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      return s;
    })(),
  },

  // ── 6b. Near win (overshoot) ──────────────────────────────────────────
  {
    id: "near-win-overshoot",
    title: "Bear Off (Overshoot)",
    description:
      "P1 has 1 checker left on the farthest position (point 6 of home). Roll 6+6: die 6 removes it exactly. Or: 1 checker on position 1 (last point before edge) — any die over 1 still bears it off.",
    fixedDice: [3, 5],
    state: (() => {
      const s = base();
      // Checker at index 23 (position 1 = closest to bearing off). Any die bears it off.
      s.board[23].checkers = [{ player: 1, isPinned: false }];
      s.borneOff = { 1: 14, 2: 5 };
      s.board[0].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      return s;
    })(),
  },

  // ── 7. P2 turn – pinned checker ────────────────────────────────────────
  {
    id: "p2-pinned",
    title: "Pinned (P2 turn)",
    description:
      "It's P2's turn. P2's checker on point 10 is pinned by P1. P2 can move other checkers but not the pinned one. Roll 4+3.",
    fixedDice: [4, 3],
    state: (() => {
      const s = base();
      s.currentTurn = 2;
      // P2 checker pinned on point 9
      s.board[9].checkers = [
        { player: 2, isPinned: true },
        { player: 1, isPinned: false },
      ];
      // P2 free checkers
      s.board[23].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      s.board[20].checkers = [
        { player: 2, isPinned: false },
        { player: 2, isPinned: false },
      ];
      // P1 checkers
      s.board[0].checkers = [
        { player: 1, isPinned: false },
        { player: 1, isPinned: false },
      ];
      return s;
    })(),
  },
];
