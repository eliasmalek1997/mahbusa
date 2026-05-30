"use client";
import { supabase, isMockMode } from "./client";
import { GameState, PlayerId, GameRecord, RoomRecord } from "../game/types";
import { initializeGame } from "../game/initialState";

// ─── Room mock helpers ────────────────────────────────────────────────────────

async function roomGet(roomCode: string): Promise<RoomRecord | null> {
  const res = await fetch(`/api/mock-room?roomCode=${roomCode}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
async function roomPost(r: RoomRecord): Promise<RoomRecord> {
  const res = await fetch("/api/mock-room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(r),
  });
  return res.json();
}
async function roomPatch(roomCode: string, patch: Partial<RoomRecord>): Promise<RoomRecord> {
  const res = await fetch(`/api/mock-room?roomCode=${roomCode}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.json();
}

// ─── Game mock helpers ────────────────────────────────────────────────────────

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
async function mockPatch(roomCode: string, patch: Partial<GameRecord>): Promise<GameRecord> {
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

// ─── Room operations ──────────────────────────────────────────────────────────

export async function getRoom(roomCode: string): Promise<RoomRecord | null> {
  if (isMockMode) return roomGet(roomCode);
  const { data } = await supabase!
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();
  return (data as RoomRecord) ?? null;
}

export async function ensureRoom(
  roomCode: string,
  player1Name: string
): Promise<RoomRecord> {
  const existing = await getRoom(roomCode);
  if (existing) return existing;

  const record: RoomRecord = {
    room_code: roomCode,
    player1_name: player1Name,
    player2_name: "",
    wins_p1: 0,
    wins_p2: 0,
    score_p1: 0,
    score_p2: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (isMockMode) return roomPost(record);
  const { data } = await supabase!.from("rooms").insert(record).select().single();
  return data as RoomRecord;
}

export async function recordGameResult(
  roomCode: string,
  winner: PlayerId,
  gameScore: number // checkers remaining for loser
): Promise<RoomRecord | null> {
  const room = await getRoom(roomCode);
  if (!room) return null;

  const patch: Partial<RoomRecord> = {
    wins_p1: room.wins_p1 + (winner === 1 ? 1 : 0),
    wins_p2: room.wins_p2 + (winner === 2 ? 1 : 0),
    score_p1: room.score_p1 + (winner === 1 ? gameScore : 0),
    score_p2: room.score_p2 + (winner === 2 ? gameScore : 0),
  };
  if (isMockMode) return roomPatch(roomCode, patch);
  const { data } = await supabase!
    .from("rooms")
    .update(patch)
    .eq("room_code", roomCode)
    .select()
    .single();
  return data as RoomRecord;
}

export function subscribeToRoom(
  roomCode: string,
  onUpdate: (room: RoomRecord) => void
): () => void {
  if (isMockMode) return () => {};
  const channel = supabase!
    .channel(`room:${roomCode}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
      (payload) => onUpdate(payload.new as RoomRecord)
    )
    .subscribe();
  return () => supabase!.removeChannel(channel);
}

// ─── Game operations ──────────────────────────────────────────────────────────

export async function createGame(
  roomCode: string,
  player1Name: string,
  initialState: GameState
): Promise<GameRecord> {
  await ensureRoom(roomCode, player1Name);

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
    .insert({ ...record, id: undefined })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GameRecord;
}

export async function getGame(roomCode: string): Promise<GameRecord | null> {
  if (isMockMode) return mockGet(roomCode);
  const { data } = await supabase!
    .from("games")
    .select("*")
    .eq("room_code", roomCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data as GameRecord) ?? null;
}

export async function joinGame(
  roomCode: string,
  player2Name: string
): Promise<GameRecord | null> {
  // Update room record too
  if (isMockMode) {
    await roomPatch(roomCode, { player2_name: player2Name });
    return mockPatch(roomCode, { player2_name: player2Name, status: "active" });
  }
  await supabase!.from("rooms").update({ player2_name: player2Name }).eq("room_code", roomCode);
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

  if (isMockMode) { await mockPatch(roomCode, patch); return; }
  const { error } = await supabase!.from("games").update(patch).eq("room_code", roomCode);
  if (error) throw new Error(error.message);
}

export async function rematch(
  roomCode: string,
  player1Name: string,
  player2Name: string,
  winner: PlayerId,
  gameScore: number
): Promise<GameRecord> {
  // Record the result in room stats
  await recordGameResult(roomCode, winner, gameScore);

  const freshState = initializeGame();
  const patch: Partial<GameRecord> = {
    status: "active",
    current_turn: 1,
    game_state: freshState,
    winner: null,
    player1_name: player1Name,
    player2_name: player2Name,
  };
  if (isMockMode) return mockPatch(roomCode, patch);
  const { data, error } = await supabase!
    .from("games")
    .update(patch)
    .eq("room_code", roomCode)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GameRecord;
}

export function subscribeToGame(
  roomCode: string,
  onUpdate: (record: GameRecord) => void
): () => void {
  if (isMockMode) return () => {};
  const channel = supabase!
    .channel(`game:${roomCode}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games", filter: `room_code=eq.${roomCode}` },
      (payload) => onUpdate(payload.new as GameRecord)
    )
    .subscribe();
  return () => supabase!.removeChannel(channel);
}
