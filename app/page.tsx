"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGame, generateRoomCode } from "@/lib/supabase/gameRepository";
import { initializeGame } from "@/lib/game/initialState";
import { isMockMode } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("mahbusa_player_name") ?? "" : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const playerName = name.trim() || "Player 1";
    setLoading(true);
    setError(null);
    try {
      const roomCode = generateRoomCode();
      const initialState = initializeGame();
      await createGame(roomCode, playerName, initialState);

      sessionStorage.setItem(
        `mahbusa_player_${roomCode}`,
        JSON.stringify({ player: 1, name: playerName })
      );
      localStorage.setItem("mahbusa_player_name", playerName);
      router.push(`/game/${roomCode}`);
    } catch (e) {
      setError("Could not create game. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,200,100,0.4) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex justify-center gap-2 text-3xl mb-2 select-none">
            <span>🎲</span>
            <span>🎲</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-stone-100">
            Mahbusa
          </h1>
          <p className="text-stone-400 text-lg leading-snug">
            Play Lebanese backgammon together,
            <br />
            from anywhere.
          </p>
        </div>

        <div className="bg-stone-900 rounded-2xl border border-white/10 p-6 shadow-2xl space-y-4">
          <input
            className="w-full bg-stone-800 border border-white/10 rounded-xl px-4 py-3
              text-stone-100 placeholder-stone-500 text-base focus:outline-none
              focus:ring-2 focus:ring-amber-500 transition"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
            maxLength={30}
          />

          {error && <p className="text-red-400 text-sm text-left">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-60
              text-white font-bold rounded-xl shadow-lg shadow-amber-900/30
              transition-all duration-150 active:scale-95 text-base"
          >
            {loading ? "Creating…" : "Create Game"}
          </button>
        </div>

        {isMockMode && (
          <div className="bg-stone-900/60 border border-amber-900/40 rounded-xl p-4 text-left space-y-1">
            <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider">
              Local Mode
            </p>
            <p className="text-stone-400 text-xs leading-relaxed">
              No Supabase config found. Running in local mock mode — open the
              game URL in a second tab to test two-player gameplay.
            </p>
          </div>
        )}

        <p className="text-stone-600 text-xs">
          No sign-up needed. Share a link. Play.
        </p>

        <Link
          href="/simulate"
          className="text-stone-600 hover:text-stone-400 text-xs transition underline underline-offset-2"
        >
          Simulation mode →
        </Link>
      </div>
    </main>
  );
}
