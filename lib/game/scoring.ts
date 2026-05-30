import { GameState, PlayerId } from "./types";
import { opponent } from "./rules";

/** Score = number of opponent checkers still on board (not borne off). */
export function computeScore(state: GameState, winner: PlayerId): number {
  const opp = opponent(winner);
  return 15 - state.borneOff[opp];
}

export function getCheckersRemaining(state: GameState, player: PlayerId): number {
  return 15 - state.borneOff[player];
}
