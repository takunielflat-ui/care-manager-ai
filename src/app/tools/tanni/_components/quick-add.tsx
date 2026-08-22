"use client";

import { クイック追加, サービス, type 要介護度 } from "@/lib/kaigo/master";
import { は月額包括 } from "@/lib/kaigo/calc";
import { 有効な軸2 } from "./state";

export default function QuickAdd({ 度, onAdd }: { 度: 要介護度; onAdd: (key: string, 軸2: string | null) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 px-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">よく使うサービス（タップで追加）</div>
      <div className="flex flex-wrap gap-1.5">
        {クイック追加.map((q) => {
          const def = サービス[q.key];
          if (!def) return null;
          const 軸2 = 有効な軸2(def, q.軸1 ?? "_", q.軸2 ?? null, 度, q.key);
          const ok = !!def.manualOnly || は月額包括({ id: 0, service: q.key }, 度) || 軸2 != null;
          return (
            <button
              key={q.short}
              type="button"
              disabled={!ok}
              title={ok ? def.label : `${度}では算定できません（総合事業などの対象です）`}
              onClick={() => onAdd(q.key, 軸2 ?? q.軸2 ?? null)}
              className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-[13.5px] font-bold shadow-sm ${
                ok
                  ? "border-teal-700 bg-white text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
                  : "cursor-not-allowed border-zinc-200 bg-white text-zinc-400 opacity-40 shadow-none dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <span className="text-[15px] leading-none">{def.icon}</span>
              {q.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
