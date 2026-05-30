"use client";
import { supabase, isMockMode } from "./client";
import { GameState, PlayerId, GameRecord } from "../game/types";

// ─── Mock API helpers (server-side store shared across all tabs) ─────────────

async function mockGet(roomCode: string): Promise<GameRecord | null> {
  const res = await fetch(`/api/mock?roomCode=${roomCode}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function mockPost(record: GameRecord): Promise<GameRecord> {
  const res = await fetch("/api/mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  return res.json();
}

async function mockPatch(
  roomCode: string,
  patch: Partial<GameRecord>
): Promise<GameRecord> {
  const res = await fetch(`/api/mock?roomCode=${roomCode}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ─── Repository ──────────────────────────────────────────────────────────────

export async function createGame(
  roomCode: string,
  player1Name: string,
  initialState: GameState
): Promise<GameRecord> {
  const record: GameRecord = {
    id: crypto.randomUUID(),
    room_code: roomCode,
    status: "waiting",
    player1_name: player1Name,
    player2_name: "",
    current_turn: 1,
    game_state: initialState,
    winner: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isMockMode) return mockPost(record);

  const { data, error } = await supabase!
    .from("games")
    .insert({
      room_code: roomCode,
      status: "waiting",
      player1_name: player1Name,
      player2_name: "",
      current_turn: 1,
      game_state: initialState,
      winner: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as GameRecord;
}

export async function getGame(roomCode: string): Promise<GameRecord | null> {
  if (isMockMode) return mockGet(roomCode);

  const { data, error } = await supabase!
    .from("games")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (error) return null;
  return data as GameRecord;
}

export async function joinGame(
  roomCode: string,
  player2Name: string
): Promise<GameRecord | null> {
  if (isMockMode) {
    return mockPatch(roomCode, { player2_name: player2Name, status: "active" });
  }

  const { data, error } = await supabase!
    .from("games")
    .update({ player2_name: player2Name, status: "active" })
    .eq("room_code", roomCode)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as GameRecord;
}

export async function updateGameState(
  roomCode: string,
  gameState: GameState,
  currentTurn: PlayerId,
  status?: "waiting" | "active" | "complete",
  winner?: PlayerId | null
): Promise<void> {
  const patch: Partial<GameRecord> = { game_state: gameState, current_turn: currentTurn };
  if (status) patch.status = status;
  if (winner !== undefined) patch.winner = winner;

  if (isMockMode) {
    await mockPatch(roomCode, patch);
    return;
  }

  const { error } = await supabase!
    .from("games")
    .update(patch)
    .eq("room_code", roomCode);

  if (error) throw new Error(error.message);
}

export function subscribeToGame(
  roomCode: string,
  onUpdate: (record: GameRecord) => void
): () => void {
  if (isMockMode) {
    // In mock mode realtime is handled by the 2-second polling fallback in the page.
    return () => {};
  }

  const channel = supabase!
    .channel(`game:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => onUpdate(payload.new as GameRecord)
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}
