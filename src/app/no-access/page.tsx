import { headers } from "next/headers";
import Link from "next/link";

import { ASSESSMENT_GUIDE_PATH, EMAIL_HEADER } from "@/lib/access";
import AppHeader from "../_components/app-header";

/**
 * 使える機能（権限）が1つもないアカウントでログインした人に見せる案内ページ。
 * 振り分けは proxy.ts が行う（権限がある人がここを開くと、使える画面へ戻される）。
 */
export default async function NoAccessPage() {
  const headersList = await headers();
  const userEmail = headersList.get(EMAIL_HEADER);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="このアカウントでは、まだご利用いただけません"
        description={<span className="break-all">ログイン中：{userEmail}</span>}
        userEmail={userEmail}
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>このメールアドレスには、まだ利用の登録がありません。</p>
        <p>
          アセスメント機能をご購入いただいた方は、登録が済むまでお待ちください。購入時のメールアドレスと、上に表示されているアドレスが同じかもご確認ください。
        </p>
        <Link
          href={ASSESSMENT_GUIDE_PATH}
          className="self-start rounded-lg border border-teal-700 bg-white px-4 py-2.5 font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
        >
          アセスメント機能のご案内
        </Link>
        <p>単位数・自己負担の電卓は、登録なしでどなたでもお使いいただけます。</p>
        <Link
          href="/tools/tanni"
          className="self-start rounded-lg border border-teal-700 bg-white px-4 py-2.5 font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
        >
          単位数電卓を開く
        </Link>
      </main>
    </div>
  );
}
