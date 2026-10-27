import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import AppHeader from "../_components/app-header";

export const metadata: Metadata = {
  title: "アセスメント一覧 | Care Manager AI",
};

export const dynamic = "force-dynamic";

const formatDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

/** 保存したアセスメントの一覧（実施日の新しい順） */
export default async function AssessmentListPage() {
  // RLS により自分のものしか返らない
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id, display_name, assessed_on, unconfirmed_count")
    .is("deleted_at", null)
    .order("assessed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch assessments:", error);
  }
  const rows = data ?? [];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="アセスメント一覧" description="保存したアセスメントです。押すと開いて続きを編集できます。">
        <Link
          href="/assessment/new"
          className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-teal-700 px-5 text-base font-bold text-white shadow-sm"
        >
          ＋ 新しく作る
        </Link>
      </AppHeader>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            一覧を読み込めませんでした。時間をおいて開き直してください。
          </p>
        ) : rows.length === 0 ? (
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            まだ保存したアセスメントはありません。「＋ 新しく作る」から始めてください。
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/assessment/${row.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-50">{row.display_name}</span>
                    <span className="text-[15px] text-zinc-600 dark:text-zinc-400">{formatDate(row.assessed_on)}</span>
                  </span>
                  {row.unconfirmed_count > 0 ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      未確認 {row.unconfirmed_count}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      ✓ 未確認なし
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
