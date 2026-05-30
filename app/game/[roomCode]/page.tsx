"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Board from "@/components/Board";
import { GameState, PlayerId } from "@/lib/game/types";
import { applyRoll, endTurn } from "@/lib/game/rules";
import { validateGameState } from "@/lib/game/initialState";
import {
  getGame,
  joinGame,
  updateGameState,
  subscribeToGame,
  getRoom,
  subscribeToRoom,
  rematch as rematchGame,
  recordGameResult,
} from "@/lib/supabase/gameRepository";
import { GameRecord, RoomRecord, RULESET } from "@/lib/game/types";
import { isMockMode } from "@/lib/supabase/client";
import { computeScore } from "@/lib/game/scoring";

type PageStatus =
  | "loading"
  | "name_prompt"
  | "waiting"
  | "playing"
  | "complete"
  | "not_found"
  | "error";

export default function GamePage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [gameRecord, setGameRecord] = useState<GameRecord | null>(null);
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerId | null>(null);
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("mahbusa_player_name") ?? "" : ""
  );
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRematching, setIsRematching] = useState(false);

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
      if (!next) setUndoStack([]); // clear history when disabling
      return next;
    });
  };

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const unsubRoomRef = useRef<(() => void) | null>(null);

  // Tab title: notify when it's your turn
  useEffect(() => {
    if (status !== "playing" || !myPlayer || !gameRecord) return;
    const isMyTurn = gameRecord.game_state?.currentTurn === myPlayer;
    document.title = isMyTurn ? "🎲 Your turn! — Mahbusa" : "Mahbusa";
    return () => { document.title = "Mahbusa"; };
  }, [gameRecord?.game_state?.currentTurn, myPlayer, status]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${roomCode}`
      : `/game/${roomCode}`;

  // ── Load & join ─────────────────────────────────────────────────────────────

  const loadGame = useCallback(async () => {
    const record = await getGame(roomCode);
    if (!record) {
      setStatus("not_found");
      return;
    }

    // Restore session
    const sessionKey = `mahbusa_player_${roomCode}`;
    const stored = sessionStorage.getItem(sessionKey);

    if (stored) {
      const { player, name } = JSON.parse(stored);
      setMyPlayer(player);
      setMyName(name);
      setGameRecord(record);
      setStatus(record.status === "waiting" ? "waiting" : record.status === "complete" ? "complete" : "playing");
      startSubscription(roomCode);
      return;
    }

    // Creator is always P1 (already stored from landing page flow via query param)
    if (record.player2_name === "" || record.status === "waiting") {
      // We could be the creator returning, or a joiner
      // If player1 session not stored here, ask for name to join as P2
      setGameRecord(record);
      setStatus("name_prompt");
    } else {
      setGameRecord(record);
      setStatus(record.status === "complete" ? "complete" : "playing");
      startSubscription(roomCode);
    }
  }, [roomCode]);

  const handleJoin = useCallback(async () => {
    const name = nameInput.trim() || "Guest";
    const record = await getGame(roomCode);
    if (!record) { setStatus("not_found"); return; }

    let player: PlayerId;

    if (record.player1_name && record.player2_name) {
      // Both taken — spectator (not implemented in MVP)
      setErrorMsg("This game is already full.");
      return;
    }

    if (!record.player2_name) {
      // Join as P2
      await joinGame(roomCode, name);
      player = 2;
    } else {
      player = 1;
    }

    const sessionKey = `mahbusa_player_${roomCode}`;
    sessionStorage.setItem(sessionKey, JSON.stringify({ player, name }));
    localStorage.setItem("mahbusa_player_name", name);
    setMyPlayer(player);
    setMyName(name);

    const updated = await getGame(roomCode);
    if (updated) setGameRecord(updated);
    setStatus(updated?.status === "active" ? "playing" : "waiting");
    startSubscription(roomCode);
  }, [roomCode, nameInput]);

  // ── Realtime subscription + polling fallback ─────────────────────────────

  const handleUpdate = useCallback((record: GameRecord) => {
    setGameRecord(record);
    if (record.status === "active") setStatus("playing");
    if (record.status === "complete") setStatus("complete");
    if (record.status === "waiting") setStatus("waiting");
  }, []);

  const startSubscription = useCallback(
    (code: string) => {
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeToGame(code, handleUpdate);

      if (unsubRoomRef.current) unsubRoomRef.current();
      unsubRoomRef.current = subscribeToRoom(code, setRoomRecord);

      // Polling fallback every 2s
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        const [r, room] = await Promise.all([getGame(code), getRoom(code)]);
        if (r) handleUpdate(r);
        if (room) setRoomRecord(room);
      }, 2000);
    },
    [handleUpdate]
  );

  useEffect(() => {
    loadGame();
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (unsubRoomRef.current) unsubRoomRef.current();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadGame]);

  // ── Game actions ─────────────────────────────────────────────────────────

  const handleStateChange = useCallback(
    async (newState: GameState) => {
      if (!gameRecord || isUpdating) return;
      setIsUpdating(true);
      try {
        if (undoEnabled) {
          setUndoStack((s) => [...s, validateGameState(gameRecord.game_state)]);
        }
        setGameRecord((r) => r ? { ...r, game_state: newState } : r);
        await updateGameState(
          roomCode,
          newState,
          newState.currentTurn,
          newState.status as "waiting" | "active" | "complete",
          newState.winner
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [gameRecord, roomCode, isUpdating, undoEnabled]
  );

  const handleRoll = useCallback(async () => {
    if (!gameRecord || isUpdating) return;
    const gs = validateGameState(gameRecord.game_state);
    if (undoEnabled) {
      setUndoStack((s) => [...s, gs]);
    }
    const newState = applyRoll(gs);
    setGameRecord((r) => r ? { ...r, game_state: newState } : r);
    await updateGameState(roomCode, newState, newState.currentTurn, "active", null);
  }, [gameRecord, isUpdating, undoEnabled, roomCode]);

  const handleEndTurn = useCallback(async () => {
    if (!gameRecord || isUpdating) return;
    const gs = validateGameState(gameRecord.game_state);
    if (undoEnabled) {
      setUndoStack((s) => [...s, gs]);
    }
    const newState = endTurn(gs);
    setGameRecord((r) => r ? { ...r, game_state: newState } : r);
    await updateGameState(roomCode, newState, newState.currentTurn, "active", null);
  }, [gameRecord, isUpdating, undoEnabled, roomCode]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isUpdating) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setIsUpdating(true);
    try {
      setGameRecord((r) => r ? { ...r, game_state: prev } : r);
      await updateGameState(
        roomCode,
        prev,
        prev.currentTurn,
        prev.status as "waiting" | "active" | "complete",
        prev.winner
      );
    } finally {
      setIsUpdating(false);
    }
  }, [undoStack, isUpdating, roomCode]);

  const handleRematch = useCallback(async () => {
    if (!gameRecord || isRematching) return;
    const gs = validateGameState(gameRecord.game_state);
    const winner = gs.winner;
    if (!winner) return;
    const gameScore = computeScore(gs, winner);
    setIsRematching(true);
    try {
      const updated = await rematchGame(
        roomCode,
        gameRecord.player1_name,
        gameRecord.player2_name,
        winner,
        gameScore
      );
      setGameRecord(updated);
      setUndoStack([]);
      const room = await getRoom(roomCode);
      if (room) setRoomRecord(room);
      setStatus("playing");
    } finally {
      setIsRematching(false);
    }
  }, [gameRecord, roomCode, isRematching]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse text-lg">Loading game…</div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-3xl font-bold text-stone-100">Game not found</h1>
        <p className="text-stone-400">Room code <code className="bg-stone-800 px-2 py-1 rounded font-mono">{roomCode}</code> doesn't exist.</p>
        <Link href="/" className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded-xl font-bold transition">
          Create a New Game
        </Link>
      </div>
    );
  }

  if (status === "name_prompt") {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="bg-stone-900 rounded-2xl border border-white/10 p-8 w-full max-w-sm shadow-2xl text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100">Join Game</h1>
            <p className="text-stone-400 mt-1">
              Room <span className="font-mono text-amber-400">{roomCode}</span>
            </p>
          </div>
          <input
            className="w-full bg-stone-800 border border-white/10 rounded-xl px-4 py-3
              text-stone-100 placeholder-stone-500 text-base focus:outline-none
              focus:ring-2 focus:ring-amber-500"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
          />
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <button
            onClick={handleJoin}
            className="w-full py-3 bg-amber-700 hover:bg-amber-600 text-white
              font-bold rounded-xl shadow-lg transition active:scale-95"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="bg-stone-900 rounded-2xl border border-white/10 p-8 w-full max-w-sm shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-900/40 border-2 border-amber-700/50
            flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl">⏳</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-100">Waiting for opponent…</h2>
            <p className="text-stone-400 mt-1 text-sm">Share this link to invite them</p>
          </div>
          <div className="bg-stone-800 rounded-xl px-4 py-3 font-mono text-amber-400 text-sm break-all">
            {shareUrl}
          </div>
          <button
            onClick={copyLink}
            className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white
              font-bold rounded-xl transition active:scale-95"
          >
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
          {isMockMode && (
            <p className="text-xs text-stone-500 border border-stone-700 rounded-lg p-3">
              Running in <strong>local mock mode</strong>. Open this URL in another browser tab to join as Player 2.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "complete") {
    const gs = gameRecord ? validateGameState(gameRecord.game_state) : null;
    const winner = gs?.winner ?? gameRecord?.winner;
    const winnerName = winner === 1 ? gameRecord?.player1_name : gameRecord?.player2_name;
    const isWinner = winner === myPlayer;
    const gameScore = gs && winner ? computeScore(gs, winner) : 0;

    // Match scores (including this game's result, pending rematch button)
    const pendingS1 = (roomRecord?.score_p1 ?? 0) + (winner === 1 ? gameScore : 0);
    const pendingS2 = (roomRecord?.score_p2 ?? 0) + (winner === 2 ? gameScore : 0);
    const matchWinner = pendingS1 >= RULESET.targetScore ? 1 : pendingS2 >= RULESET.targetScore ? 2 : null;

    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="bg-stone-900 rounded-2xl border border-white/10 p-8 w-full max-w-sm shadow-2xl text-center space-y-5">
          <div className="text-5xl">{isWinner ? "🏆" : "🎲"}</div>

          <div>
            <h2 className="text-2xl font-bold text-stone-100">
              {isWinner ? "You won!" : `${winnerName} won!`}
            </h2>
            <p className="text-stone-400 text-sm mt-1">+{gameScore} points</p>
          </div>

          {/* Match score toward 31 */}
          <div className="bg-stone-800 rounded-xl p-4 space-y-2">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider">
              Match score — first to {RULESET.targetScore}
            </p>
            <div className="flex justify-between items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-stone-300 text-sm font-semibold truncate">{gameRecord?.player1_name || "P1"}</p>
                <p className={`text-2xl font-bold ${pendingS1 >= RULESET.targetScore ? "text-emerald-400" : "text-stone-100"}`}>
                  {pendingS1}
                </p>
                <p className="text-stone-500 text-xs">{roomRecord?.wins_p1 ?? 0} wins</p>
              </div>
              <div className="text-stone-600 font-bold">vs</div>
              <div className="flex-1 text-center">
                <p className="text-stone-300 text-sm font-semibold truncate">{gameRecord?.player2_name || "P2"}</p>
                <p className={`text-2xl font-bold ${pendingS2 >= RULESET.targetScore ? "text-emerald-400" : "text-stone-100"}`}>
                  {pendingS2}
                </p>
                <p className="text-stone-500 text-xs">{roomRecord?.wins_p2 ?? 0} wins</p>
              </div>
            </div>
          </div>

          {matchWinner ? (
            <div className="bg-emerald-900/40 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-emerald-300 font-bold text-sm">
                🏆 {matchWinner === 1 ? gameRecord?.player1_name : gameRecord?.player2_name} wins the match!
              </p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              onClick={handleRematch}
              disabled={isRematching}
              className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50
                text-white font-bold rounded-xl transition active:scale-95"
            >
              {isRematching ? "Starting…" : "↺ Rematch"}
            </button>
            <Link
              href="/"
              className="flex-1 py-3 bg-stone-700 hover:bg-stone-600 text-white
                font-bold rounded-xl transition active:scale-95 text-center text-sm"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Playing
  if (!gameRecord) return null;
  const gs = validateGameState(gameRecord.game_state);

  return (
    <div className="min-h-screen bg-stone-950 py-4 px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-4 px-2 gap-2">
        <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm transition flex-shrink-0">
          ← Home
        </Link>
        <span className="text-stone-500 font-mono text-xs bg-stone-900 px-3 py-1.5 rounded-lg border border-white/10">
          {roomCode}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Undo toggle */}
          <button
            onClick={toggleUndo}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition
              ${undoEnabled
                ? "bg-indigo-900/50 border-indigo-500/50 text-indigo-300"
                : "bg-stone-900 border-white/10 text-stone-500 hover:text-stone-300"
              }`}
            title={undoEnabled ? "Undo enabled — click to disable" : "Undo disabled — click to enable"}
          >
            ↩ {undoEnabled ? "Undo on" : "Undo off"}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="text-stone-400 hover:text-stone-200 text-sm transition"
          >
            Rules ?
          </button>
        </div>
      </div>

      {/* Match score strip */}
      {roomRecord && (roomRecord.score_p1 > 0 || roomRecord.score_p2 > 0 || roomRecord.wins_p1 > 0 || roomRecord.wins_p2 > 0) && (
        <div className="max-w-5xl mx-auto mb-3 px-2">
          <div className="bg-stone-900/70 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
            <div className="text-center">
              <span className="text-stone-400 text-xs block">Match score</span>
              <span className="font-bold text-stone-100">{roomRecord.score_p1} — {roomRecord.score_p2}</span>
            </div>
            <div className="text-stone-600 text-xs">of {RULESET.targetScore}</div>
            <div className="text-center">
              <span className="text-stone-400 text-xs block">Wins</span>
              <span className="font-bold text-stone-100">{roomRecord.wins_p1} — {roomRecord.wins_p2}</span>
            </div>
          </div>
        </div>
      )}

      <Board
        gameState={gs}
        myPlayer={myPlayer!}
        player1Name={gameRecord.player1_name || "Player 1"}
        player2Name={gameRecord.player2_name || "Player 2"}
        onStateChange={handleStateChange}
        onRoll={handleRoll}
        onEndTurn={handleEndTurn}
        onUndo={handleUndo}
        canUndo={undoEnabled && undoStack.length > 0}
      />

      {/* Rules modal */}
      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowRules(false)}
        >
          <div
            className="bg-stone-900 rounded-2xl border border-white/10 p-6 max-w-md w-full
              max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-stone-100">Lebanese Mahbusa</h2>
              <button onClick={() => setShowRules(false)} className="text-stone-400 hover:text-stone-200 text-xl">✕</button>
            </div>
            <div className="text-stone-300 text-sm space-y-3 leading-relaxed">
              <p><strong className="text-amber-400">Object:</strong> Be the first player to bear off all 15 checkers.</p>
              <p><strong className="text-amber-400">Start:</strong> All 15 checkers begin on your starting point. Player 1 starts at point 1, Player 2 at point 24.</p>
              <p><strong className="text-amber-400">Movement:</strong> Roll two dice. Move one checker for each die value. Doubles give you four moves of that number.</p>
              <p><strong className="text-amber-400">Blocking:</strong> A point with 2 or more of your opponent's checkers is blocked — you cannot land there.</p>
              <p><strong className="text-amber-400">Pinning:</strong> If you land on a point with exactly one opposing checker, you pin it. A pinned checker cannot move until you leave that point.</p>
              <p><strong className="text-amber-400">Bearing off:</strong> Once all your remaining checkers are in your home board (last 6 points), you may start bearing off.</p>
              <p><strong className="text-amber-400">No hitting:</strong> Unlike standard backgammon, there is no bar — pinning replaces hitting.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
