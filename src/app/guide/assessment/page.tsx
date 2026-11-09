import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EMAIL_HEADER } from "@/lib/access";
import AppHeader from "../../_components/app-header";

export const metadata: Metadata = {
  title: "アセスメント機能のご案内 | Care Manager AI",
};

/**
 * アセスメントの権限がない人がアセスメントを開いたときの購入案内。紹介ページへ誘導する。
 * 振り分けは proxy.ts が行う（アセスメントの権限がある人がここを開くと、アセスメント一覧へ戻される）。
 */
export default async function AssessmentGuidePage() {
  const userEmail = (await headers()).get(EMAIL_HEADER);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="アセスメント機能のご案内"
        description={<span className="break-all">ログイン中：{userEmail}</span>}
        userEmail={userEmail}
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>アセスメント機能は、ご購入いただいた方がご利用いただけます。</p>
        <p>
          選択肢を選ぶだけで、アセスメントの文章ができあがります。AI は使わず、介護ソフトの欄ごとにコピーして貼り付けられます。
        </p>
        <Link
          href="/lp/assessment"
          className="self-start rounded-lg border border-teal-700 bg-white px-4 py-2.5 font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
        >
          詳しい内容とご購入はこちら
        </Link>
        <p>ご質問は Threads からお問い合わせください。</p>
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-[15px] dark:border-zinc-800 dark:bg-zinc-950">
          ご購入済みの方：登録が済むと、このページを開き直したときにアセスメントが使えるようになります。購入時のメールアドレスと、上に表示されているアドレスが同じかご確認ください。
        </p>
      </main>
    </div>
  );
}
