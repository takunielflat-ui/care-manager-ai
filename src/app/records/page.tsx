import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import LogoutButton from "../_components/logout-button";
import RecordsList, { type VisitRecord } from "./_components/records-list";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_records")
    .select("id, visit_date, display_name, note, generated_text, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch visit_records:", error);
  }

  const records = (data ?? []) as VisitRecord[];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              ← 新しい記録を作成
            </Link>
            <div className="flex shrink-0 items-center gap-4">
              <Link
                href="/help"
                className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
              >
                使い方
              </Link>
              <LogoutButton />
            </div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            記録一覧
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            保存した第5表の記録です。介護ソフトへのコピペが済んだらステータスを切り替えてください。
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <RecordsList initialRecords={records} />
      </main>
    </div>
  );
}
