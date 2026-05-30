"use client";
import { DICE_NAMES } from "@/lib/game/types";

interface DiceProps {
  values: number[];
  used: boolean[];
  isMyTurn: boolean;
  rolling?: boolean;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({
  value,
  used,
  rolling,
}: {
  value: number;
  used: boolean;
  rolling?: boolean;
}) {
  const pips = PIPS[value] ?? [];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          relative w-10 h-10 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-lg sm:rounded-xl border-2 shadow-lg
          transition-all duration-200
          ${rolling ? "animate-dice-roll" : ""}
          ${used
            ? "bg-stone-300 border-stone-400 opacity-40"
            : "bg-amber-50 border-amber-300 shadow-amber-200/60"
          }
        `}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full p-2">
          {pips.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={9}
              className={used ? "fill-stone-500" : "fill-stone-800"}
            />
          ))}
        </svg>
      </div>
      <span
        className={`text-xs font-bold tracking-wide transition-all
          ${used ? "text-stone-600" : "text-amber-300"}`}
      >
        {DICE_NAMES[value]}
      </span>
    </div>
  );
}

export default function Dice({ values, used, isMyTurn, rolling }: DiceProps) {
  const isDoubles = values.length === 4;
  const dieName = DICE_NAMES[values[0]];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Doubles call-out */}
      {isDoubles && (
        <p className="text-amber-400 font-bold text-sm tracking-widest uppercase animate-pulse">
          {dieName}-{dieName}!
        </p>
      )}
      <div className="flex gap-2 items-end">
        {values.map((v, i) => (
          <DieFace key={i} value={v} used={used[i]} rolling={rolling} />
        ))}
      </div>
    </div>
  );
}
