import { headers } from "next/headers";
import Link from "next/link";

import AppHeader from "../_components/app-header";

/**
 * 無料モニター期間中に、許可されていないアカウントでログインした人に見せる案内ページ。
 * 振り分けは proxy.ts が行う（許可済みの人がここを開くとトップへ戻される）。
 */
export default async function NoAccessPage() {
  const headersList = await headers();
  const userEmail = headersList.get("x-user-email");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        menu="limited"
        title="現在は無料モニターの方だけがご利用いただけます"
        description={<span className="break-all">ログイン中：{userEmail}</span>}
        userEmail={userEmail}
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>
          このメールアドレスは、まだ利用の登録がされていません。モニターへの参加はThreadsで受け付けています。
        </p>
        <p>
          すでに参加をお申し込みの方は、登録が済むまでお待ちください。お伝えいただいたメールアドレスと、上に表示されているアドレスが同じかもご確認ください。
        </p>
        <p>
          単位数・自己負担の電卓は、登録なしでどなたでもお使いいただけます。
        </p>
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
