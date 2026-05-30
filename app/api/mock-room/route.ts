import { NextRequest, NextResponse } from "next/server";
import { RoomRecord } from "@/lib/game/types";

declare global {
  // eslint-disable-next-line no-var
  var __mahbusa_mock_rooms: Record<string, RoomRecord> | undefined;
}
if (!global.__mahbusa_mock_rooms) global.__mahbusa_mock_rooms = {};
const store = global.__mahbusa_mock_rooms;

export async function GET(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode) return NextResponse.json(null);
  return NextResponse.json(store[roomCode] ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as RoomRecord;
  store[body.room_code] = { ...body, updated_at: new Date().toISOString() };
  return NextResponse.json(store[body.room_code]);
}

export async function PATCH(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode || !store[roomCode])
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = await req.json();
  store[roomCode] = { ...store[roomCode], ...patch, updated_at: new Date().toISOString() };
  return NextResponse.json(store[roomCode]);
}
