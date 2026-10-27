import { headers } from "next/headers";
import Link from "next/link";

import { todayInJapan } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "./_components/app-header";
import VisitRecordForm from "./_components/visit-record-form";

// 訪問日の初期値にリクエスト時点の日付を使うため、ビルド時のプリレンダリングを避ける。
export const dynamic = "force-dynamic";

export default async function Home() {
  // 認証確認は proxy.ts が既に行っているので、ここでは結果(メールアドレス)を
  // ヘッダー経由で受け取るだけにし、supabase.auth.getUser() の二重呼び出しを避ける。
  const headersList = await headers();
  const userEmail = headersList.get("x-user-email");

  // 定型文はAIに一切渡さず、生成結果への文字列連結にのみ使う（src/app/api/generate/route.ts は参照しない）。
  const supabase = await createClient();
  const { data: cannedPhrasesData, error: cannedPhrasesError } = await supabase
    .from("canned_phrases")
    .select("id, body, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (cannedPhrasesError) {
    console.error("Failed to fetch canned_phrases:", cannedPhrasesError);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        isTop
        title="訪問記録の入力"
        description="入力内容をもとに第5表（居宅介護支援経過）を作成します。"
        userEmail={userEmail}
      >
        <Link
          href="/assessment/new"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-teal-700 bg-white px-4 text-base font-bold text-teal-700 dark:border-teal-500 dark:bg-zinc-950 dark:text-teal-400"
        >
          アセスメントを作る →
        </Link>
      </AppHeader>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <VisitRecordForm
          defaultVisitDate={todayInJapan()}
          cannedPhrases={cannedPhrasesData ?? []}
        />
      </main>
    </div>
  );
}
