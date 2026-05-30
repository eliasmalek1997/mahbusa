"use client";
import { PlayerId } from "@/lib/game/types";

interface PlayerPanelProps {
  name: string;
  player: PlayerId;
  isCurrentTurn: boolean;
  borneOff: number;
  isMe: boolean;
}

export default function PlayerPanel({ name, player, isCurrentTurn, borneOff, isMe }: PlayerPanelProps) {
  const checkerColor =
    player === 1
      ? "bg-amber-100 border-amber-400"
      : "bg-stone-800 border-stone-500";

  return (
    <div
      className={`
        flex items-center gap-2 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl border transition-all duration-300
        ${isCurrentTurn
          ? "bg-emerald-900/40 border-emerald-500/50 shadow-lg shadow-emerald-900/20"
          : "bg-stone-900/40 border-white/10"
        }
      `}
    >
      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex-shrink-0 ${checkerColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-stone-100 truncate text-sm sm:text-base max-w-[80px] sm:max-w-none">
            {name || `P${player}`}
          </span>
          {isMe && (
            <span className="text-[9px] sm:text-[10px] bg-stone-700 text-stone-300 px-1 py-0.5 rounded font-medium flex-shrink-0">
              You
            </span>
          )}
        </div>
        <p className="text-stone-400 text-[10px] sm:text-xs">
          {borneOff}/15 off
        </p>
      </div>
      {isCurrentTurn && (
        <div className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-xs font-semibold flex-shrink-0">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Turn</span>
        </div>
      )}
    </div>
  );
}
