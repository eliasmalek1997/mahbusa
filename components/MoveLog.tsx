"use client";
import { useEffect, useRef } from "react";

interface MoveLogProps {
  history: string[];
}

export default function MoveLog({ history }: MoveLogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="bg-stone-900/60 rounded-xl border border-white/10 p-3">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Move Log</p>
      <div ref={ref} className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin">
        {history.length === 0 ? (
          <p className="text-stone-500 text-sm italic">No moves yet.</p>
        ) : (
          history.map((entry, i) => (
            <p key={i} className="text-stone-300 text-xs font-mono leading-relaxed">
              {i + 1}. {entry}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
