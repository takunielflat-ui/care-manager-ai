"use client";

import type { 計算結果 } from "@/lib/kaigo/calc";

const 帯色 = {
  safe: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  caution: "bg-gradient-to-r from-amber-400 to-amber-500",
  over: "bg-gradient-to-r from-red-400 to-red-600",
} as const;

const 帯文字色 = {
  safe: "text-emerald-600 dark:text-emerald-400",
  caution: "text-amber-600 dark:text-amber-400",
  over: "text-red-600 dark:text-red-400",
} as const;

export function GaugeBar({ r, big }: { r: 計算結果; big?: boolean }) {
  const pct = Math.min(100, r.使用率 * 100);
  return (
    <div className={`overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 ${big ? "h-4" : "h-2.5"}`}>
      <div className={`h-full rounded-full transition-[width] duration-300 ${帯色[r.帯]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function 帯ラベル({ r }: { r: 計算結果 }) {
  return <span className={`font-extrabold ${帯文字色[r.帯]}`}>{(r.使用率 * 100).toFixed(0)}％</span>;
}

export { 帯色, 帯文字色 };
