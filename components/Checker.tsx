"use client";
import { PlayerId } from "@/lib/game/types";

interface CheckerProps {
  player: PlayerId;
  isPinned?: boolean;
  count?: number; // stack display
  isSelected?: boolean;
  isSmall?: boolean;
}

export default function Checker({
  player,
  isPinned,
  count,
  isSelected,
  isSmall,
}: CheckerProps) {
  const base = isSmall ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm";
  const color =
    player === 1
      ? "bg-amber-100 border-amber-400 text-amber-900 shadow-amber-200"
      : "bg-stone-800 border-stone-600 text-stone-100 shadow-stone-900";
  const pinRing = isPinned ? "ring-2 ring-red-400" : "";
  const selectedRing = isSelected ? "ring-2 ring-emerald-400 scale-110" : "";

  return (
    <div
      className={`
        ${base} ${color} ${pinRing} ${selectedRing}
        rounded-full border-2 flex items-center justify-center
        font-bold shadow-md select-none transition-transform duration-150
        relative
      `}
    >
      {count && count > 1 ? count : ""}
      {isPinned && (
        <span className="absolute -top-1 -right-1 text-[8px] bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
          ✕
        </span>
      )}
    </div>
  );
}
