"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import { GameState, PlayerId } from "@/lib/game/types";
import {
  applyRoll,
  endTurn,
  getLegalMoves,
  applyMove,
  hasLegalMovesRemaining,
  allDiceUsed,
} from "@/lib/game/rules";
import { pickBestMove } from "@/lib/game/ai";
import { SCENARIOS, Scenario } from "@/lib/game/scenarios";

// Speed options for auto-play (ms between each action)
const SPEEDS = [
  { label: "Slow", ms: 1200 },
  { label: "Normal", ms: 600 },
  { label: "Fast", ms: 200 },
];

export default function SimulatePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const autoPlayRef = useRef(false);

  // Undo
  const [undoEnabled, setUndoEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mahbusa_undo") === "true";
  });
  const [undoStack, setUndoStack] = useState<GameState[]>([]);

  const toggleUndo = () => {
    setUndoEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("mahbusa_undo", String(next));
      if (!next) setUndoStack([]);
      return next;
    });
  };

  // ── Scenario loading ──────────────────────────────────────────────────

  const loadScenario = (s: Scenario) => {
    setIsAutoPlaying(false);
    autoPlayRef.current = false;
    setUndoStack([]);
    const fresh: GameState = JSON.parse(JSON.stringify(s.state));
    setScenario(s);
    setGameState(fresh);
    setActiveId(s.id);
  };

  // ── Manual controls (Board callbacks) ────────────────────────────────

  const handleStateChange = useCallback(async (next: GameState) => {
    if (undoEnabled) setUndoStack((s) => [...s, gameState!]);
    setGameState(next);
  }, [undoEnabled, gameState]);

  const handleRoll = useCallback(async () => {
    if (!gameState || !scenario) return;
    if (undoEnabled) setUndoStack((s) => [...s, gameState]);
    let next: GameState = JSON.parse(JSON.stringify(gameState));
    if (scenario.fixedDice && !next.hasRolled) {
      const [a, b] = scenario.fixedDice;
      next.dice =
        a === b
          ? { values: [a, a, a, a], used: [false, false, false, false] }
          : { values: [a, b], used: [false, false] };
      next.hasRolled = true;
      setScenario((s) => (s ? { ...s, fixedDice: undefined } : s));
    } else {
      next = applyRoll(next);
    }
    setGameState(next);
  }, [gameState, scenario, undoEnabled]);

  const handleEndTurn = useCallback(async () => {
    if (!gameState) return;
    if (undoEnabled) setUndoStack((s) => [...s, gameState]);
    setGameState(endTurn(gameState));
  }, [gameState, undoEnabled]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setGameState(prev);
  }, [undoStack]);

  // ── Auto-play engine ──────────────────────────────────────────────────

  const stepAutoPlay = useCallback((gs: GameState): GameState => {
    if (gs.status === "complete") return gs;

    if (!gs.hasRolled) {
      return applyRoll(gs);
    }

    const best = pickBestMove(gs);
    if (best) {
      return applyMove(gs, best);
    }

    // No moves remaining → end turn
    return endTurn(gs);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || !gameState) return;
    if (gameState.status === "complete") {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
      return;
    }

    const delay = SPEEDS[speedIdx].ms;
    const timer = setTimeout(() => {
      if (!autoPlayRef.current) return;
      setGameState((gs) => (gs ? stepAutoPlay(gs) : gs));
    }, delay);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, gameState, speedIdx, stepAutoPlay]);

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
    } else {
      // Start from scratch with a fresh full game if no scenario loaded
      if (!gameState) {
        // Load starting position
        const start = SCENARIOS.find((s) => s.id === "start")!;
        loadScenario(start);
      }
      autoPlayRef.current = true;
      setIsAutoPlaying(true);
    }
  };

  const currentPlayer = gameState?.currentTurn ?? 1;

  return (
    <div className="min-h-screen bg-stone-950 py-4 px-3">
      {/* Header */}
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-4">
        <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm transition">
          ← Home
        </Link>
        <h1 className="text-stone-200 font-bold text-lg">Simulation Mode</h1>
        <span className="text-stone-600 text-xs">no persistence</span>
      </div>

      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        {/* Scenario picker + auto-play controls */}
        <div className="bg-stone-900 border border-white/10 rounded-2xl p-4 space-y-3">
          {/* Scenario grid */}
          <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
            Choose a Scenario
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => loadScenario(s)}
                className={`
                  text-left px-3 py-2.5 rounded-xl border text-sm transition-all
                  ${activeId === s.id
                    ? "bg-amber-800/50 border-amber-600/60 text-amber-200"
                    : "bg-stone-800 border-white/10 text-stone-300 hover:border-amber-700/40 hover:text-stone-100"
                  }
                `}
              >
                <span className="font-semibold block leading-tight">{s.title}</span>
              </button>
            ))}
          </div>

          {/* Undo toggle */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/5">
            <button
              onClick={toggleUndo}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition
                ${undoEnabled
                  ? "bg-indigo-900/50 border-indigo-500/50 text-indigo-300"
                  : "bg-stone-800 border-white/10 text-stone-500 hover:text-stone-300"
                }`}
            >
              ↩ Undo {undoEnabled ? "on" : "off"}
            </button>
            {undoEnabled && (
              <span className="text-stone-600 text-xs">
                {undoStack.length} step{undoStack.length !== 1 ? "s" : ""} in history
              </span>
            )}
          </div>

          {/* Auto-play controls */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/5">
            <button
              onClick={toggleAutoPlay}
              className={`
                px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95
                ${isAutoPlaying
                  ? "bg-red-700 hover:bg-red-600 text-white"
                  : "bg-indigo-700 hover:bg-indigo-600 text-white"
                }
              `}
            >
              {isAutoPlaying ? "⏹ Stop" : "▶ Watch Auto-Play"}
            </button>

            {/* Speed picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 text-xs">Speed:</span>
              {SPEEDS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setSpeedIdx(i)}
                  className={`
                    px-2.5 py-1 rounded-lg text-xs font-semibold transition
                    ${speedIdx === i
                      ? "bg-stone-600 text-stone-100"
                      : "bg-stone-800 text-stone-400 hover:text-stone-200"
                    }
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {isAutoPlaying && (
              <span className="text-indigo-400 text-xs animate-pulse font-medium ml-auto">
                ● Playing…
              </span>
            )}
          </div>
        </div>

        {/* Scenario description */}
        {scenario && !isAutoPlaying && (
          <div className="bg-stone-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-300 flex items-start gap-3">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">ℹ</span>
            <div>
              <span className="font-semibold text-stone-200">{scenario.title}: </span>
              {scenario.description}
              {scenario.fixedDice && (
                <span className="ml-2 text-amber-400/80 text-xs">
                  (first roll fixed: {scenario.fixedDice[0]}+{scenario.fixedDice[1]})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Winner banner */}
        {gameState?.status === "complete" && (
          <div className="bg-emerald-900/50 border border-emerald-500/30 rounded-xl px-4 py-3 text-center text-emerald-200 font-bold text-base">
            🏆 Player {gameState.winner} wins!
          </div>
        )}

        {/* Board — in auto-play, board is read-only (myPlayer is never the current turn) */}
        {gameState ? (
          <Board
            gameState={gameState}
            myPlayer={isAutoPlaying ? (3 as PlayerId) : currentPlayer}
            player1Name="Player 1"
            player2Name="Player 2"
            onStateChange={handleStateChange}
            onRoll={handleRoll}
            onEndTurn={handleEndTurn}
            onUndo={handleUndo}
            canUndo={undoEnabled && undoStack.length > 0 && !isAutoPlaying}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-stone-500 italic text-base">
            Select a scenario above — or click Watch Auto-Play to see a full game
          </div>
        )}

        {/* Reset + Switch Turn */}
        {scenario && gameState && !isAutoPlaying && (
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadScenario(scenario)}
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200
                font-semibold rounded-xl border border-white/10 text-sm transition"
            >
              ↺ Reset Scenario
            </button>
            <button
              onClick={() =>
                setGameState((s) =>
                  s ? { ...s, currentTurn: s.currentTurn === 1 ? 2 : 1 } : s
                )
              }
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200
                font-semibold rounded-xl border border-white/10 text-sm transition"
            >
              ⇄ Switch Turn
            </button>
          </div>
        )}

        {/* State inspector */}
        {gameState && (
          <details className="bg-stone-900/60 border border-white/10 rounded-xl p-4">
            <summary className="text-xs text-stone-400 font-semibold uppercase tracking-wider cursor-pointer select-none">
              State Inspector
            </summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-300">
              <div className="bg-stone-800 rounded-lg p-2.5">
                <p className="text-stone-500 mb-1">Turn</p>
                <p className="font-mono font-bold text-stone-100">Player {gameState.currentTurn}</p>
              </div>
              <div className="bg-stone-800 rounded-lg p-2.5">
                <p className="text-stone-500 mb-1">Dice</p>
                <p className="font-mono font-bold text-stone-100">
                  {gameState.dice
                    ? gameState.dice.values
                        .map((v, i) => (gameState.dice!.used[i] ? `[${v}]` : v))
                        .join(" ")
                    : "—"}
                </p>
              </div>
              <div className="bg-stone-800 rounded-lg p-2.5">
                <p className="text-stone-500 mb-1">Borne Off</p>
                <p className="font-mono font-bold text-stone-100">
                  P1: {gameState.borneOff[1]} / P2: {gameState.borneOff[2]}
                </p>
              </div>
              <div className="bg-stone-800 rounded-lg p-2.5">
                <p className="text-stone-500 mb-1">Status</p>
                <p className="font-mono font-bold text-stone-100">{gameState.status}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-stone-500 mb-1.5 font-semibold uppercase tracking-wider">
                Board (non-empty points)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {gameState.board.map((pt, i) =>
                  pt.checkers.length === 0 ? null : (
                    <div key={i} className="bg-stone-800 rounded-lg px-2.5 py-1.5 text-xs font-mono">
                      <span className="text-stone-500">pt{i + 1}: </span>
                      {pt.checkers.map((c, ci) => (
                        <span
                          key={ci}
                          className={c.player === 1 ? "text-amber-300" : "text-stone-300"}
                        >
                          {c.isPinned ? "⊗" : "●"}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
