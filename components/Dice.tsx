"use client";

interface DiceProps {
  values: number[];
  used: boolean[];
  isMyTurn: boolean;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({ value, used }: { value: number; used: boolean }) {
  const pips = PIPS[value] ?? [];
  return (
    <div
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 shadow-lg
        transition-all duration-200
        ${used
          ? "bg-stone-300 border-stone-400 opacity-40"
          : "bg-ivory bg-amber-50 border-amber-300 shadow-amber-200"
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
  );
}

export default function Dice({ values, used, isMyTurn }: DiceProps) {
  return (
    <div className="flex gap-2 items-center">
      {values.map((v, i) => (
        <DieFace key={i} value={v} used={used[i]} />
      ))}
    </div>
  );
}
