"use client";
import { useState, useCallback } from "react";
import { GameState, Move, PlayerId } from "@/lib/game/types";
import {
  getLegalMoves,
  applyMove,
  allDiceUsed,
  hasLegalMovesRemaining,
} from "@/lib/game/rules";
import PointComponent from "./Point";
import Dice from "./Dice";
import MoveLog from "./MoveLog";
import PlayerPanel from "./PlayerPanel";

interface BoardProps {
  gameState: GameState;
  myPlayer: PlayerId;
  player1Name: string;
  player2Name: string;
  onStateChange: (newState: GameState) => Promise<void>;
  onRoll: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onUndo?: () => Promise<void>;
  canUndo?: boolean;
}

export default function Board({
  gameState,
  myPlayer,
  player1Name,
  player2Name,
  onStateChange,
  onRoll,
  onEndTurn,
  onUndo,
  canUndo = false,
}: BoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const isMyTurn = gameState.currentTurn === myPlayer;
  const legalMoves = isMyTurn && gameState.hasRolled ? getLegalMoves(gameState) : [];

  const legalFromSelected = selectedPoint !== null
    ? legalMoves.filter((m) => m.from === selectedPoint)
    : [];
  const legalDestinations = new Set(legalFromSelected.map((m) => m.to));
  const legalSources = new Set(legalMoves.map((m) => m.from));

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 2500);
  };

  const handlePointClick = useCallback(
    async (index: number) => {
      if (!isMyTurn || !gameState.hasRolled || isActing) return;

      if (selectedPoint === null) {
        // Select a source
        if (!legalSources.has(index)) {
          const checkers = gameState.board[index].checkers;
          const hasOwn = checkers.some((c) => c.player === myPlayer);
          if (hasOwn) {
            showError("That checker is pinned and cannot move.");
          }
          return;
        }
        setSelectedPoint(index);
        return;
      }

      if (selectedPoint === index) {
        // If all legal moves from this point are bear-offs, execute one immediately.
        // (There is no on-board point to click as a destination for to:24.)
        const bearOffMoves = legalFromSelected.filter((m) => m.to === 24);
        if (bearOffMoves.length > 0 && bearOffMoves.length === legalFromSelected.length) {
          setIsActing(true);
          try {
            const newState = applyMove(gameState, bearOffMoves[0]);
            await onStateChange(newState);
          } catch {
            showError("Illegal move.");
          } finally {
            setIsActing(false);
            setSelectedPoint(null);
          }
          return;
        }
        setSelectedPoint(null);
        return;
      }

      // Try to move selectedPoint → index
      const candidateMoves = legalMoves.filter(
        (m) => m.from === selectedPoint && m.to === index
      );

      if (candidateMoves.length === 0) {
        // Maybe re-select
        if (legalSources.has(index)) {
          setSelectedPoint(index);
          return;
        }
        showError("That move is blocked.");
        setSelectedPoint(null);
        return;
      }

      // Pick the first candidate (smallest die first for efficiency)
      const move = candidateMoves[0];
      setIsActing(true);
      try {
        const newState = applyMove(gameState, move);
        await onStateChange(newState);
        setSelectedPoint(null);
      } catch (e) {
        showError("Illegal move.");
      } finally {
        setIsActing(false);
      }
    },
    [gameState, myPlayer, isMyTurn, selectedPoint, legalMoves, legalSources, onStateChange, isActing]
  );

  const canEndTurn =
    isMyTurn &&
    gameState.hasRolled &&
    (!hasLegalMovesRemaining(gameState) || allDiceUsed(gameState));

  // True when the selected checker's only legal moves are bearing off
  const selectedCanOnlyBearOff =
    selectedPoint !== null &&
    legalFromSelected.length > 0 &&
    legalFromSelected.every((m) => m.to === 24);

  // True when ANY legal move right now is a bear-off (used for hint even before selection)
  const anyBearOffAvailable = legalMoves.some((m) => m.to === 24);

  // Board layout:
  // Top row: points 12→23 (left to right) — P2's outer board to home
  // Bottom row: points 11→0 (left to right) — P1's outer board to home
  const topPoints = Array.from({ length: 12 }, (_, i) => i + 12); // 12-23
  const bottomPoints = Array.from({ length: 12 }, (_, i) => 11 - i); // 11-0

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      {/* Player panels */}
      <div className="grid grid-cols-2 gap-3">
        <PlayerPanel
          name={player1Name}
          player={1}
          isCurrentTurn={gameState.currentTurn === 1}
          borneOff={gameState.borneOff[1]}
          isMe={myPlayer === 1}
        />
        <PlayerPanel
          name={player2Name}
          player={2}
          isCurrentTurn={gameState.currentTurn === 2}
          borneOff={gameState.borneOff[2]}
          isMe={myPlayer === 2}
        />
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="text-center bg-red-900/50 border border-red-500/30 text-red-300 py-2 px-4 rounded-lg text-sm animate-fade-in">
          {errorMsg}
        </div>
      )}

      {/* Board */}
      <div className="bg-amber-900 rounded-2xl shadow-2xl border-4 border-amber-950 overflow-hidden relative">
        {/* Board felt texture overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-800/20 to-amber-950/20 pointer-events-none" />

        {/* Top row (points 12-23) */}
        <div className="flex justify-between px-2 pt-2 border-b border-amber-950/50">
          <div className="flex gap-0.5">
            {topPoints.slice(0, 6).map((i) => (
              <PointComponent
                key={i}
                point={gameState.board[i]}
                index={i}
                isTop={true}
                isLegal={isMyTurn && gameState.hasRolled && (
                  selectedPoint !== null
                    ? legalDestinations.has(i)
                    : legalSources.has(i)
                )}
                isSelected={selectedPoint === i}
                selectedFrom={selectedPoint}
                onClick={handlePointClick}
              />
            ))}
          </div>
          {/* Bar */}
          <div className="w-8 sm:w-10 bg-amber-950/60 flex items-center justify-center">
            <div className="w-1 h-full bg-amber-900/50 rounded" />
          </div>
          <div className="flex gap-0.5">
            {topPoints.slice(6).map((i) => (
              <PointComponent
                key={i}
                point={gameState.board[i]}
                index={i}
                isTop={true}
                isLegal={isMyTurn && gameState.hasRolled && (
                  selectedPoint !== null
                    ? legalDestinations.has(i)
                    : legalSources.has(i)
                )}
                isSelected={selectedPoint === i}
                selectedFrom={selectedPoint}
                onClick={handlePointClick}
              />
            ))}
          </div>
        </div>

        {/* Middle strip with dice */}
        <div className="flex items-center justify-center py-3 gap-4 bg-amber-950/30 flex-wrap">
          {gameState.dice ? (
            <Dice
              values={gameState.dice.values}
              used={gameState.dice.used}
              isMyTurn={isMyTurn}
            />
          ) : (
            <div className="h-14 flex items-center">
              <p className="text-amber-300/50 text-sm italic">
                {isMyTurn ? "Roll to start your turn" : "Waiting for opponent…"}
              </p>
            </div>
          )}
          {selectedCanOnlyBearOff && (
            <p className="text-emerald-300 text-xs font-semibold animate-pulse">
              Tap checker again to bear off ↗
            </p>
          )}
          {!selectedPoint && anyBearOffAvailable && isMyTurn && (
            <p className="text-amber-300/60 text-xs italic">
              You can bear off — tap a checker
            </p>
          )}
        </div>

        {/* Bottom row (points 11-0) */}
        <div className="flex justify-between px-2 pb-2 border-t border-amber-950/50">
          <div className="flex gap-0.5">
            {bottomPoints.slice(0, 6).map((i) => (
              <PointComponent
                key={i}
                point={gameState.board[i]}
                index={i}
                isTop={false}
                isLegal={isMyTurn && gameState.hasRolled && (
                  selectedPoint !== null
                    ? legalDestinations.has(i)
                    : legalSources.has(i)
                )}
                isSelected={selectedPoint === i}
                selectedFrom={selectedPoint}
                onClick={handlePointClick}
              />
            ))}
          </div>
          {/* Bar */}
          <div className="w-8 sm:w-10 bg-amber-950/60 flex items-center justify-center">
            <div className="w-1 h-full bg-amber-900/50 rounded" />
          </div>
          <div className="flex gap-0.5">
            {bottomPoints.slice(6).map((i) => (
              <PointComponent
                key={i}
                point={gameState.board[i]}
                index={i}
                isTop={false}
                isLegal={isMyTurn && gameState.hasRolled && (
                  selectedPoint !== null
                    ? legalDestinations.has(i)
                    : legalSources.has(i)
                )}
                isSelected={selectedPoint === i}
                selectedFrom={selectedPoint}
                onClick={handlePointClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      {isMyTurn && (
        <div className="flex gap-3 justify-center flex-wrap">
          {!gameState.hasRolled && (
            <button
              onClick={onRoll}
              disabled={isActing}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40
                transition-all duration-150 active:scale-95 text-base"
            >
              🎲 Roll Dice
            </button>
          )}
          {selectedCanOnlyBearOff && (
            <button
              onClick={() => selectedPoint !== null && handlePointClick(selectedPoint)}
              disabled={isActing}
              className="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50
                text-white font-bold rounded-xl shadow-lg shadow-amber-900/40
                transition-all duration-150 active:scale-95 text-base"
            >
              Bear Off ↗
            </button>
          )}
          {canEndTurn && (
            <button
              onClick={onEndTurn}
              disabled={isActing}
              className="px-8 py-3 bg-stone-700 hover:bg-stone-600 disabled:opacity-50
                text-white font-bold rounded-xl shadow-lg
                transition-all duration-150 active:scale-95 text-base"
            >
              End Turn →
            </button>
          )}
          {canUndo && onUndo && (
            <button
              onClick={() => { setSelectedPoint(null); onUndo(); }}
              disabled={isActing}
              className="px-5 py-3 bg-stone-800 hover:bg-stone-700 disabled:opacity-40
                text-stone-300 hover:text-stone-100 font-semibold rounded-xl border border-white/10
                transition-all duration-150 active:scale-95 text-sm"
              title="Undo last move"
            >
              ↩ Undo
            </button>
          )}
        </div>
      )}

      {/* Move log */}
      <MoveLog history={gameState.moveHistory} />
    </div>
  );
}
