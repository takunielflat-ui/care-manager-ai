import type { Metadata } from "next";

import { todayInJapan } from "@/lib/date";
import AppHeader from "../../_components/app-header";
import AssessmentForm from "../_components/assessment-form";

export const metadata: Metadata = {
  title: "アセスメント | Care Manager AI",
};

// 実施日の初期値にリクエスト時点の日付を使うため、ビルド時のプリレンダリングを避ける。
export const dynamic = "force-dynamic";

/**
 * 選択式アセスメントの新規作成画面。
 * ★AI は使わない。文章は src/lib/assessment/build.ts がその場で組み立てる。
 * ★保存するまで入力内容はブラウザにも残さない（端末を共有している人がいるため）。
 * ログイン確認・モニター限定は proxy.ts が行う。
 */
export default function AssessmentNewPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="アセスメント"
        description="項目ごとに当てはまるものを選ぶと、アセスメントの文章ができます。保存すると一覧から開き直せます。"
      />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <AssessmentForm defaultDate={todayInJapan()} />
      </main>
    </div>
  );
}
