import {
  GameState,
  PlayerId,
  Move,
  DiceRoll,
  PLAYER_DIRECTION,
  PLAYER_HOME_RANGE,
  RULESET,
} from "./types";

// ─── Dice ────────────────────────────────────────────────────────────────────

export function rollDice(): DiceRoll {
  const a = Math.ceil(Math.random() * 6);
  const b = Math.ceil(Math.random() * 6);
  if (a === b) {
    return { values: [a, a, a, a], used: [false, false, false, false] };
  }
  return { values: [a, b], used: [false, false] };
}

// ─── Point classification helpers ────────────────────────────────────────────

/** True if the point is controlled (blocked) by the given player's opponent. */
function isBlockedByOpponent(state: GameState, pointIndex: number, player: PlayerId): boolean {
  const opp = opponent(player);
  const checkers = state.board[pointIndex].checkers;
  if (checkers.length === 0) return false;
  // A point is blocked if it has 2+ opponent checkers OR any opponent checkers and no friendly ones
  const oppCount = checkers.filter((c) => c.player === opp).length;
  const ownCount = checkers.filter((c) => c.player === player).length;
  if (ownCount > 0) return false; // we have checkers there, not blocked for us
  return oppCount >= 2;
}

/** True if moving onto this point would pin a single opponent checker. */
function wouldPin(state: GameState, pointIndex: number, player: PlayerId): boolean {
  if (!RULESET.allowPinning) return false;
  const opp = opponent(player);
  const checkers = state.board[pointIndex].checkers;
  const oppCount = checkers.filter((c) => c.player === opp).length;
  const ownCount = checkers.filter((c) => c.player === player).length;
  // Can pin only if exactly 1 opponent checker and we bring 1 of ours
  return oppCount === 1 && ownCount === 0;
}

/** True if moving onto this point is a legal landing for the player. */
function canLandOn(state: GameState, pointIndex: number, player: PlayerId): boolean {
  if (pointIndex < 0 || pointIndex > 23) return false;
  const checkers = state.board[pointIndex].checkers;
  if (checkers.length === 0) return true;

  const opp = opponent(player);
  const oppCount = checkers.filter((c) => c.player === opp).length;
  const ownCount = checkers.filter((c) => c.player === player).length;

  if (ownCount > 0) {
    // We already own this point — always allowed to stack more checkers here.
    // The pinned opponent underneath stays trapped while any of our checkers remain.
    return true;
  }

  // Point has only opponent checkers
  if (oppCount >= 2) return false; // blocked
  if (oppCount === 1 && RULESET.allowPinning) return true; // pin it
  return false;
}

/** True if the checker at this point (belonging to player) is pinned. */
function isCheckerPinned(state: GameState, pointIndex: number, player: PlayerId): boolean {
  return state.board[pointIndex].checkers.some(
    (c) => c.player === player && c.isPinned
  );
}

// ─── Home board detection ────────────────────────────────────────────────────

export function canBearOff(state: GameState, player: PlayerId): boolean {
  const [lo, hi] = PLAYER_HOME_RANGE[player];
  for (let i = 0; i < 24; i++) {
    if (i >= lo && i <= hi) continue;
    // ANY own checker outside the home board — pinned or not — blocks bearing off.
    // A pinned checker is still on the board; the opponent must move away before
    // the player can get it home and eventually bear off.
    const hasOwn = state.board[i].checkers.some((c) => c.player === player);
    if (hasOwn) return false;
  }
  return true;
}

// ─── Legal moves ─────────────────────────────────────────────────────────────

export function getLegalMoves(state: GameState): Move[] {
  if (!state.dice || !state.hasRolled) return [];
  const player = state.currentTurn;
  const dir = PLAYER_DIRECTION[player];
  const moves: Move[] = [];
  const unusedDice = state.dice.values
    .map((v, i) => ({ value: v, index: i }))
    .filter((_, i) => !state.dice!.used[i]);

  const uniqueDiceValues = new Set(unusedDice.map((d) => d.value));

  for (const dv of uniqueDiceValues) {
    const dieIndex = unusedDice.find((d) => d.value === dv)!.index;

    // Normal board moves
    for (let from = 0; from < 24; from++) {
      const point = state.board[from];
      const ownCheckers = point.checkers.filter((c) => c.player === player);
      if (ownCheckers.length === 0) continue;

      // If our topmost checker is pinned, it cannot move
      const topChecker = point.checkers[point.checkers.length - 1];
      if (topChecker.player === player && topChecker.isPinned) continue;

      // Also check: if any of our checkers is pinned (in Mahbusa the top one pins the bottom one)
      const movableOwn = ownCheckers.some((c) => !c.isPinned);
      if (!movableOwn) continue;

      const to = from + dir * dv;

      if (to >= 0 && to <= 23) {
        if (canLandOn(state, to, player)) {
          moves.push({ from, to, dieIndex });
        }
      } else {
        // Potential bear-off
        if (canBearOff(state, player)) {
          const [lo, hi] = PLAYER_HOME_RANGE[player];
          if (from >= lo && from <= hi) {
            if (player === 1) {
              if (to === 24) {
                // Exact: die value matches this checker's distance to the edge
                moves.push({ from, to: 24, dieIndex });
              } else if (to > 24) {
                // Overshoot: die is larger than needed. Rule: remove the checker
                // at the FARTHEST position (lowest index = highest position number).
                // e.g. checkers on positions 1 & 2, die 4 → remove from position 2.
                const farthest = getLowestOwnPoint(state, player);
                if (from === farthest) {
                  moves.push({ from, to: 24, dieIndex });
                }
              }
            } else {
              // Player 2 moves toward index 0; home board is [0,5]
              if (to === -1) {
                moves.push({ from, to: 24, dieIndex });
              } else if (to < -1) {
                // Farthest P2 checker = highest index in home board
                const farthest = getHighestOwnPoint(state, player);
                if (from === farthest) {
                  moves.push({ from, to: 24, dieIndex });
                }
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${m.from}-${m.to}-${m.dieIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getHighestOwnPoint(state: GameState, player: PlayerId): number {
  for (let i = 23; i >= 0; i--) {
    if (state.board[i].checkers.some((c) => c.player === player && !c.isPinned))
      return i;
  }
  return -1;
}

function getLowestOwnPoint(state: GameState, player: PlayerId): number {
  for (let i = 0; i < 24; i++) {
    if (state.board[i].checkers.some((c) => c.player === player && !c.isPinned))
      return i;
  }
  return 24;
}

// ─── Apply move ──────────────────────────────────────────────────────────────

export function applyMove(state: GameState, move: Move): GameState {
  const legal = getLegalMoves(state);
  const isLegal = legal.some(
    (m) => m.from === move.from && m.to === move.to && m.dieIndex === move.dieIndex
  );
  if (!isLegal) {
    throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  }

  const player = state.currentTurn;
  const opp = opponent(player);

  // Deep clone
  const next: GameState = JSON.parse(JSON.stringify(state));
  const dice = next.dice!;
  dice.used[move.dieIndex] = true;

  if (move.to === 24) {
    // Bear off: remove the top movable own checker from `from`
    removeTopMovableChecker(next, move.from, player);
    next.borneOff[player]++;
    next.moveHistory.push(`P${player} bears off from point ${move.from + 1}`);
  } else {
    const destPoint = next.board[move.to];
    const srcPoint = next.board[move.from];

    const oppCountAtDest = destPoint.checkers.filter((c) => c.player === opp).length;
    const ownCountAtDest = destPoint.checkers.filter((c) => c.player === player).length;
    // First time landing on a lone opponent = fresh pin.
    // Landing on a point we already own (with a pinned opp underneath) = stack.
    const isFirstPin = oppCountAtDest === 1 && ownCountAtDest === 0 && RULESET.allowPinning;
    const isStackingOnPin = oppCountAtDest === 1 && ownCountAtDest > 0;

    // Remove one movable checker from source
    removeTopMovableChecker(next, move.from, player);

    if (isFirstPin) {
      const oppChecker = destPoint.checkers.find((c) => c.player === opp);
      if (oppChecker) oppChecker.isPinned = true;
      destPoint.checkers.push({ player, isPinned: false });
      next.moveHistory.push(`P${player} moves ${move.from + 1}→${move.to + 1} (pins opponent)`);
    } else if (isStackingOnPin) {
      // Opponent already pinned; our checker stacks on top, pin stays
      destPoint.checkers.push({ player, isPinned: false });
      next.moveHistory.push(`P${player} moves ${move.from + 1}→${move.to + 1} (stacks)`);
    } else {
      destPoint.checkers.push({ player, isPinned: false });
      next.moveHistory.push(`P${player} moves ${move.from + 1}→${move.to + 1}`);
    }

    // If we moved away from a point where we were pinning, unpin the opponent
    unpinIfFreed(next, move.from, opp);
  }

  // Check game over
  if (next.borneOff[player] === 15) {
    next.status = "complete";
    next.winner = player;
  }

  return next;
}

function removeTopMovableChecker(state: GameState, pointIndex: number, player: PlayerId) {
  const checkers = state.board[pointIndex].checkers;
  // Find last (top) movable checker belonging to player
  for (let i = checkers.length - 1; i >= 0; i--) {
    if (checkers[i].player === player && !checkers[i].isPinned) {
      checkers.splice(i, 1);
      return;
    }
  }
}

/** After one of our checkers leaves a point, unpin any trapped opponent if no own checkers remain. */
function unpinIfFreed(state: GameState, pointIndex: number, opp: PlayerId) {
  const checkers = state.board[pointIndex].checkers;
  const pinnerPlayer = opp === 1 ? 2 : 1;
  const hasOwnLeft = checkers.some((c) => c.player === pinnerPlayer);
  if (!hasOwnLeft) {
    checkers.forEach((c) => {
      if (c.player === opp) c.isPinned = false;
    });
  }
}

// ─── End turn / game over ────────────────────────────────────────────────────

export function isGameOver(state: GameState): boolean {
  return state.status === "complete";
}

export function endTurn(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.currentTurn = opponent(state.currentTurn);
  next.dice = null;
  next.hasRolled = false;
  return next;
}

export function applyRoll(state: GameState): GameState {
  if (state.hasRolled) throw new Error("Already rolled this turn");
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.dice = rollDice();
  next.hasRolled = true;
  return next;
}

export function hasLegalMovesRemaining(state: GameState): boolean {
  return getLegalMoves(state).length > 0;
}

export function allDiceUsed(state: GameState): boolean {
  if (!state.dice) return true;
  return state.dice.used.every(Boolean);
}

// ─── Utils ───────────────────────────────────────────────────────────────────

export function opponent(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}
