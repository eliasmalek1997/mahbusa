import { NextRequest, NextResponse } from "next/server";
import { GameRecord } from "@/lib/game/types";

// Server-side in-memory store — shared across all browser tabs in local dev.
// This module is only imported when Supabase env vars are absent.
declare global {
  // eslint-disable-next-line no-var
  var __mahbusa_mock_store: Record<string, GameRecord> | undefined;
}
if (!global.__mahbusa_mock_store) {
  global.__mahbusa_mock_store = {};
}
const store = global.__mahbusa_mock_store;

export async function GET(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode) return NextResponse.json({ error: "roomCode required" }, { status: 400 });
  const record = store[roomCode] ?? null;
  return NextResponse.json(record);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as GameRecord;
  const { room_code } = body;
  if (!room_code) return NextResponse.json({ error: "room_code required" }, { status: 400 });
  store[room_code] = { ...body, updated_at: new Date().toISOString() };
  return NextResponse.json(store[room_code]);
}

export async function PATCH(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode) return NextResponse.json({ error: "roomCode required" }, { status: 400 });
  if (!store[roomCode]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = await req.json();
  store[roomCode] = { ...store[roomCode], ...patch, updated_at: new Date().toISOString() };
  return NextResponse.json(store[roomCode]);
}
