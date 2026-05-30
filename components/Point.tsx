"use client";
import { Point as PointType, PlayerId } from "@/lib/game/types";
import Checker from "./Checker";

interface PointProps {
  point: PointType;
  index: number;
  isTop: boolean;
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
  const total = point.checkers.length;
  const topPlayer: PlayerId | null =
    total > 0 ? point.checkers[total - 1].player : null;
  const displayCheckers = point.checkers.slice(-Math.min(total, 4));

  return (
    <div
      onClick={() => onClick(index)}
      className={`
        relative flex flex-col items-center cursor-pointer select-none
        flex-1 min-w-0
        ${isTop ? "justify-start pt-0.5" : "justify-end pb-0.5"}
        ${isSelected ? "bg-emerald-500/20 rounded" : ""}
        ${isLegal ? "bg-emerald-400/10 rounded" : ""}
        transition-colors duration-150
        min-h-[80px] sm:min-h-[110px] md:min-h-[130px]
      `}
    >
      {/* Triangle spike */}
      <div
        className={`absolute ${isTop ? "top-0" : "bottom-0"} w-full ${isTop ? "" : "rotate-180"}`}
        style={{ height: "100%" }}
      >
        <svg viewBox="0 0 56 140" className="w-full h-full" preserveAspectRatio="none">
          <polygon
            points="28,6 2,134 54,134"
            className={isLight ? "fill-amber-700/60" : "fill-stone-600/60"}
          />
        </svg>
      </div>

      {/* Legal move dot */}
      {isLegal && !selectedFrom && (
        <div className={`absolute ${isTop ? "top-1" : "bottom-1"} z-20
          w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-emerald-400/80 border border-emerald-300 animate-pulse`}
        />
      )}
      {isLegal && selectedFrom !== null && (
        <div className={`absolute ${isTop ? "top-1" : "bottom-1"} z-20
          w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border border-emerald-300`}
        />
      )}

      {/* Checkers */}
      <div className={`relative z-10 flex flex-col ${isTop ? "" : "flex-col-reverse"} items-center gap-px py-0.5 w-full`}>
        {total > 0 && (
          total > 4 ? (
            <div className="relative flex justify-center w-full">
              <Checker player={topPlayer!} isPinned={point.checkers[total - 1].isPinned} isSelected={isSelected} />
              <span className="absolute -top-1 -right-0.5 bg-stone-900 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white/20">
                {total}
              </span>
            </div>
          ) : (
            displayCheckers.map((c, i) => (
              <div key={i} className="flex justify-center w-full">
                <Checker
                  player={c.player}
                  isPinned={c.isPinned}
                  isSelected={isSelected && i === displayCheckers.length - 1}
                  isSmall={total > 2}
                />
              </div>
            ))
          )
        )}
      </div>

      {/* Point label */}
      <span className={`absolute text-[7px] sm:text-[9px] text-white/30 font-mono ${isTop ? "bottom-0.5" : "top-0.5"}`}>
        {index + 1}
      </span>
    </div>
  );
}
