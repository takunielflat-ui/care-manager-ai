import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL } from "@/lib/sales";
import PublicFooter from "../../../_components/public-footer";

export const metadata: Metadata = {
  title: "ご購入ありがとうございます | ケアマネAI",
  // 決済を終えた人だけが見るページ。検索結果には出さない
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    title: "ログインしてください",
    body: "購入時に入力したメールアドレスで、caremane-ai.com にログインしてください。メールで6桁のコードが届きます。",
  },
  {
    title: "使えるようになるまでお待ちください",
    body: "24時間以内に、アセスメント機能を使えるようにします。準備ができたら、メールでお知らせします。",
  },
  {
    title: "メールが見つからないときは",
    body: "ログインのメールが見つからない場合は、迷惑メールフォルダもご確認ください。",
  },
];

/**
 * 決済完了ページ。Stripe の決済リンクの「完了後の移動先」に、このページのアドレスを入れる。
 * ログインなしで見られる（/lp 配下は proxy.ts で公開）。
 */
export default function PurchaseThanksPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <Link href="/lp/assessment" className="font-bold text-teal-700 dark:text-teal-400">
            ケアマネAI
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h1 className="text-2xl leading-snug font-bold text-zinc-900 dark:text-zinc-100">ご購入ありがとうございます。</h1>

        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="font-bold text-teal-700 dark:text-teal-400">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1">{step.body}</p>
            </li>
          ))}
        </ol>

        <Link
          href="/login"
          className="flex min-h-14 items-center justify-center rounded-xl bg-teal-700 px-4 text-lg font-bold text-white hover:bg-teal-800"
        >
          ログイン画面へ
        </Link>

        <p className="break-all">お問い合わせ：{CONTACT_EMAIL}</p>
      </main>

      <PublicFooter />
    </div>
  );
}
