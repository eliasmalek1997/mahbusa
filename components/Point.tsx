"use client";
import { Point as PointType, PlayerId } from "@/lib/game/types";
import Checker from "./Checker";

interface PointProps {
  point: PointType;
  index: number;
  isTop: boolean; // board is split top/bottom
  isLegal: boolean;
  isSelected: boolean;
  selectedFrom: number | null;
  onClick: (index: number) => void;
}

export default function Point({
  point,
  index,
  isTop,
  isLegal,
  isSelected,
  selectedFrom,
  onClick,
}: PointProps) {
  const isLight = index % 2 === 0;
  const pointColor = isLight
    ? "bg-amber-700/80"
    : "bg-stone-600/80";

  const checkersByPlayer = {
    1: point.checkers.filter((c) => c.player === 1),
    2: point.checkers.filter((c) => c.player === 2),
  };

  const total = point.checkers.length;
  const topPlayer: PlayerId | null =
    point.checkers.length > 0
      ? point.checkers[point.checkers.length - 1].player
      : null;
  const pinnedChecker = point.checkers.find((c) => c.isPinned);

  // Show stacked checkers with a count badge if > 3
  const displayCheckers = point.checkers.slice(-Math.min(total, 4));

  return (
    <div
      onClick={() => onClick(index)}
      className={`
        relative flex flex-col items-center cursor-pointer select-none
        w-12 sm:w-14 md:w-16
        ${isTop ? "justify-start pt-1" : "justify-end pb-1"}
        ${isSelected ? "bg-emerald-500/20 rounded" : ""}
        ${isLegal ? "bg-emerald-400/10 rounded cursor-pointer" : ""}
        transition-colors duration-150
        min-h-[120px] sm:min-h-[140px]
      `}
    >
      {/* Triangle spike */}
      <div
        className={`
          absolute ${isTop ? "top-0" : "bottom-0"}
          w-full
          ${isTop ? "" : "rotate-180"}
        `}
        style={{ height: "100%" }}
      >
        <svg
          viewBox="0 0 56 140"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <polygon
            points="28,6 2,134 54,134"
            className={isLight ? "fill-amber-700/60" : "fill-stone-600/60"}
          />
        </svg>
      </div>

      {/* Legal move indicator dot */}
      {isLegal && !selectedFrom && (
        <div
          className={`absolute ${isTop ? "top-2" : "bottom-2"} z-20
            w-5 h-5 rounded-full bg-emerald-400/70 border-2 border-emerald-300 animate-pulse`}
        />
      )}
      {isLegal && selectedFrom !== null && (
        <div
          className={`absolute ${isTop ? "top-2" : "bottom-2"} z-20
            w-5 h-5 rounded-full bg-emerald-400 border-2 border-emerald-300`}
        />
      )}

      {/* Checkers */}
      <div
        className={`relative z-10 flex flex-col ${isTop ? "" : "flex-col-reverse"} items-center gap-0.5 py-1`}
      >
        {total > 0 && (
          <>
            {total > 4 ? (
              <div className="relative">
                <Checker
                  player={topPlayer!}
                  isPinned={topPlayer !== null && point.checkers[point.checkers.length - 1].isPinned}
                  isSelected={isSelected}
                />
                <span className="absolute -top-1 -right-1 bg-stone-900 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white/20">
                  {total}
                </span>
              </div>
            ) : (
              displayCheckers.map((c, i) => (
                <Checker
                  key={i}
                  player={c.player}
                  isPinned={c.isPinned}
                  isSelected={isSelected && i === displayCheckers.length - 1}
                  isSmall={total > 2}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Point label */}
      <span
        className={`absolute text-[10px] text-white/40 font-mono
          ${isTop ? "bottom-1" : "top-1"}`}
      >
        {index + 1}
      </span>
    </div>
  );
}
