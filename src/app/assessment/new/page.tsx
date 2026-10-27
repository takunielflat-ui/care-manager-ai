import type { Metadata } from "next";

import AppHeader from "../../_components/app-header";
import AssessmentForm from "./_components/assessment-form";

export const metadata: Metadata = {
  title: "アセスメント | Care Manager AI",
};

/**
 * 選択式アセスメントの入力画面。
 * ★AI は使わない。文章は src/lib/assessment/build.ts がその場で組み立てる。
 * ★保存（DB）はまだない。入力内容はブラウザにも残さない（端末を共有している人がいるため）。
 * ログイン確認・モニター限定は proxy.ts が行う。
 */
export default function AssessmentNewPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="アセスメント"
        description="項目ごとに当てはまるものを選ぶと、アセスメントの文章ができます。入力内容は保存されません。"
      />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <AssessmentForm />
      </main>
    </div>
  );
}
