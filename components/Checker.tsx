"use client";
import { PlayerId } from "@/lib/game/types";

interface CheckerProps {
  player: PlayerId;
  isPinned?: boolean;
  isSelected?: boolean;
  isSmall?: boolean;
}

export default function Checker({ player, isPinned, isSelected, isSmall }: CheckerProps) {
  const base = isSmall
    ? "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[8px]"
    : "w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-[9px] sm:text-xs";

  const color =
    player === 1
      ? "bg-amber-100 border-amber-400 text-amber-900 shadow-amber-200"
      : "bg-stone-800 border-stone-600 text-stone-100 shadow-stone-900";

  const pinRing = isPinned ? "ring-1 sm:ring-2 ring-red-400" : "";
  const selectedRing = isSelected ? "ring-1 sm:ring-2 ring-emerald-400 scale-110" : "";

  return (
    <div
      className={`
        ${base} ${color} ${pinRing} ${selectedRing}
        rounded-full border-2 flex items-center justify-center flex-shrink-0
        font-bold shadow-md select-none transition-transform duration-150
        relative
      `}
    >
      {isPinned && (
        <span className="absolute -top-0.5 -right-0.5 text-[6px] bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center leading-none">
          ✕
        </span>
      )}
    </div>
  );
}
