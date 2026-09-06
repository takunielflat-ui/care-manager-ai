import type { Metadata } from "next";
import Link from "next/link";

import TanniPlansView from "../_components/tanni-plans-view";

export const metadata: Metadata = {
  title: "保存した計算の一覧・比較｜介護サービス 単位数シミュレーター",
  description: "保存した単位数の計算を一覧で見直したり、2件を並べて比較できます。",
  alternates: {
    canonical: "/tools/tanni/plans",
  },
};

export default function TanniPlansPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/tools/tanni"
              className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              ← シミュレーターに戻る
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              経過記録のトップへ
            </Link>
          </div>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            保存した計算
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            保存した単位数の計算を見直したり、2件を並べて比較できます。
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <TanniPlansView />
      </main>
    </div>
  );
}
