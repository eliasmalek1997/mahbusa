import { GameState, Move, PlayerId, PLAYER_DIRECTION, PLAYER_HOME_RANGE } from "./types";
import { getLegalMoves, applyMove, opponent } from "./rules";

// ─── Board evaluation ─────────────────────────────────────────────────────────

/**
 * Score the board from `player`'s perspective after all moves are applied.
 * Higher = better for player.
 */
function evaluateBoard(state: GameState, player: PlayerId): number {
  const opp = opponent(player);
  const dir = PLAYER_DIRECTION[player];
  const [lo, hi] = PLAYER_HOME_RANGE[player];
  let score = 0;

  // Borne-off checkers are pure progress
  score += state.borneOff[player] * 25;
  score -= state.borneOff[opp] * 25;

  for (let i = 0; i < 24; i++) {
    const pt = state.board[i];
    const ownCheckers = pt.checkers.filter((c) => c.player === player);
    const oppCheckers = pt.checkers.filter((c) => c.player === opp);
    const ownCount = ownCheckers.length;
    const oppCount = oppCheckers.length;

    if (ownCount > 0) {
      // Reward: distance advanced toward home (0-23 range)
      // For P1 dir=+1: higher index = more advanced = better
      // For P2 dir=-1: lower index = more advanced = better
      const progress = dir === 1 ? i : 23 - i;
      score += ownCount * progress * 2;

      // Bonus for being in home board
      if (i >= lo && i <= hi) score += ownCount * 15;

      // Penalty for lone checker outside home (vulnerable to pin)
      if (ownCount === 1 && oppCount === 0 && !(i >= lo && i <= hi)) score -= 40;

      // Bonus for block (2+ own checkers = blocks opponent)
      if (ownCount >= 2 && oppCount === 0) score += 30;

      // Bonus for pinning an opponent checker
      const pinnedOpp = oppCheckers.filter((c) => c.isPinned).length;
      score += pinnedOpp * 60;
    }

    if (oppCount > 0) {
      // Penalty: opponent progress
      const oppProgress = dir === -1 ? i : 23 - i;
      score -= oppCount * oppProgress * 2;

      // Penalty: opponent blocks our path
      if (oppCount >= 2) {
        // How much does this block our movement? Weight by position
        const blockImpact = dir === 1 ? i : 23 - i;
        score -= 20 + blockImpact;
      }
    }
  }

  return score;
}

// ─── Move scoring ─────────────────────────────────────────────────────────────

function scoreMove(state: GameState, move: Move): number {
  const player = state.currentTurn;
  const opp = opponent(player);
  const [lo, hi] = PLAYER_HOME_RANGE[player];
  let score = 0;

  // Bearing off is always the top priority
  if (move.to === 24) return 10_000;

  const dest = state.board[move.to];
  const src  = state.board[move.from];

  const ownAtDest = dest.checkers.filter((c) => c.player === player).length;
  const oppAtDest = dest.checkers.filter((c) => c.player === opp).length;
  // How many own movable checkers remain at source after this move?
  const ownAtSrcAfter = src.checkers.filter(
    (c) => c.player === player && !c.isPinned
  ).length - 1;

  // ── Destination bonuses ──────────────────────────────────────────────
  if (oppAtDest === 1 && ownAtDest === 0) {
    // Pin a lone opponent — high value
    score += 180;
  } else if (oppAtDest === 1 && ownAtDest >= 1) {
    // Stack on an already-pinned point — reinforce the pin
    score += 80;
  } else if (ownAtDest === 1 && oppAtDest === 0) {
    // Join our own single → creates a block (very good)
    score += 120;
  } else if (ownAtDest >= 2 && oppAtDest === 0) {
    // Add to an existing block (useful, diminishing returns)
    score += 40;
  } else if (ownAtDest === 0 && oppAtDest === 0) {
    // Empty point — neutral
    score += 5;
  }

  // ── Source penalty ───────────────────────────────────────────────────
  if (ownAtSrcAfter === 1) {
    // Leaving a single behind outside home = risky
    const inHome = move.from >= lo && move.from <= hi;
    if (!inHome) score -= 60;
  }

  // ── Progress bonus ───────────────────────────────────────────────────
  const dir = PLAYER_DIRECTION[player];
  const advance = (move.to - move.from) * dir;
  score += advance * 4;

  // Entering home board for the first time — good milestone
  const destInHome = move.to >= lo && move.to <= hi;
  const srcInHome  = move.from >= lo && move.from <= hi;
  if (destInHome && !srcInHome) score += 35;

  // ── Look-ahead: evaluate the resulting board ─────────────────────────
  // Apply the move and score the resulting position
  try {
    const next = applyMove(JSON.parse(JSON.stringify(state)), move);
    score += evaluateBoard(next, player) * 0.3;
  } catch {
    // Should never throw since move is from getLegalMoves
  }

  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pick the best legal move for the current player using heuristic scoring.
 * Adds a small random noise so the AI isn't perfectly deterministic.
 */
export function pickBestMove(state: GameState): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  let best: Move = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    // Small random noise (±5) so equal moves vary naturally
    const noise = (Math.random() - 0.5) * 10;
    const s = scoreMove(state, move) + noise;
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }

  return best;
}
