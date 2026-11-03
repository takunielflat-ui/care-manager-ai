import type { Metadata } from "next";
import Link from "next/link";

import AppHeader from "../../_components/app-header";

export const metadata: Metadata = {
  title: "アセスメントの使い方 | Care Manager AI",
};

// AppHeader が proxy.ts の渡すヘッダー（使える機能）を読むため
export const dynamic = "force-dynamic";

/**
 * アセスメントの使い方。購入者（アセスメントだけ使える人）向け。
 * /assessment の下にあるので、開けるのはアセスメントの権限がある人だけ（proxy.ts）。
 * ★ボタン名は画面の表示と同じ文字にする（assessment-form.tsx を変えたらここも直す）。
 */

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-base font-bold text-white">
        {step}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {children}
        </ul>
      </div>
    </li>
  );
}

const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-bold text-zinc-900 dark:text-zinc-50">{children}</strong>
);

export default function AssessmentHelpPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="アセスメントの使い方" description="選択肢を選ぶだけで、アセスメントの文章ができます。AI は使いません。" />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
        <ol className="flex flex-col gap-3">
          <StepCard step={1} title="はじめてのログイン">
            <li>購入時のメールアドレスを入力して「コードを送信」を押します。</li>
            <li>届いたメールに書かれている数字のコードを入力します。</li>
            <li>メールが届かないときは、迷惑メールフォルダも見てください。再送信は60秒たつとできます。</li>
          </StepCard>

          <StepCard step={2} title="新しく作る">
            <li>
              <Link
                href="/assessment"
                className="font-bold text-teal-700 underline underline-offset-2 dark:text-teal-400"
              >
                アセスメント一覧
              </Link>
              の「＋ 新しく作る」を押します。
            </li>
            <li>「利用者の表示名」は実名ではなく、イニシャルなどで入れてください（例：A様）。</li>
            <li>
              「ご家族の続柄」（長女・妻など）を登録しておくと、家事や通院の付き添いなどの選択肢に出てきます。登録しなければ「家族」と書かれます。
            </li>
          </StepCard>

          <StepCard step={3} title="選ぶ">
            <li>「基本動作」「移動」などの見出しを押すと開きます。当てはまるものを選んでください。</li>
            <li>
              まだ選んでいない項目は「未確認」と表示されます。画面下の「未確認 ○件 ▸」を押すと、残っている項目に移動します。
            </li>
            <li>
              選択肢にないことは「備考」に書けます。<B>利用者・家族の氏名は書かないでください。</B>
            </li>
          </StepCard>

          <StepCard step={4} title="文章をコピーして貼り付ける">
            <li>下の「できあがった文章」に文章が出てきます。</li>
            <li>見出しごとの「📋 コピー」を押して、介護ソフトの同じ欄に貼り付けます。</li>
            <li>「📋 全部コピー」を押すと、まとめてコピーできます。</li>
            <li>「未確認の項目も文に入れる」にチェックを入れると、未確認の項目も【未確認】として文に入ります。</li>
          </StepCard>

          <StepCard step={5} title="保存・続きの編集・削除">
            <li>「💾 保存」を押すと一覧に残ります。一覧から開くと、続きを直せます。</li>
            <li>
              <B>保存しないで画面を離れると、入力した内容は消えます。</B>
            </li>
            <li>いらなくなったものは、開いて一番下の「🗑️ このアセスメントを削除」を押します。</li>
          </StepCard>

          <StepCard step={6} title="困ったとき">
            <li>「コピーできませんでした」と出たら、文章を長押しして選び、コピーしてください。</li>
            <li>お問い合わせは Threads からお願いします。</li>
          </StepCard>
        </ol>
      </main>
    </div>
  );
}
