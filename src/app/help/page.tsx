import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import LogoutButton from "../_components/logout-button";

export const dynamic = "force-dynamic";

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
        {step}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{title}</p>
        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                href="/tools/tanni"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
              >
                単位数電卓
              </Link>
              {user && <LogoutButton />}
            </div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            使い方
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            初めての方向けの簡単なご案内です。
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            このアプリでできること
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            訪問時のメモをAIに読み込ませて、第5表（居宅介護支援経過）の文章を自動で下書きします。
            訪問メモを入力するだけで、介護ソフトにそのままコピペできる文章が作成できます。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            基本の流れ
          </h2>
          <ol className="flex flex-col gap-3">
            <StepCard step={1} title="訪問メモを入力する">
              トップ画面（
              <Link href="/" className="text-teal-700 underline-offset-2 hover:underline dark:text-teal-400">
                新しい記録を作成
              </Link>
              ）で、訪問日・利用者名・訪問メモを入力します。利用者名やメモは実名のまま入力して構いません。
              入力中の内容は自動で一時保存されるので、途中で画面を閉じても「前回の下書きを復元」から続きを入力できます。
            </StepCard>
            <StepCard step={2} title="「⚡ 簡潔」または「📄 詳細」をタップする">
              AIが訪問メモをもとに第5表の文章を作成します。少し時間がかかりますが、書き終わった文章から順に画面に表示されます。
              <br />
              いつもの定型的な訪問記録は「⚡ 簡潔」（見出しなし、200〜350字程度）で十分です。新規利用開始・状態変化・家族との調整・サービス内容の変更・医療連携・担当者会議前など、経緯を整理して残したい場面では「📄 詳細」（内容・アセスメント・対応の3項目、400〜700字程度）を選んでください。
            </StepCard>
            <StepCard step={3} title="内容を確認してコピーする">
              AIが作った文章はあくまで下書きです。必ず内容を確認してから、「📋 コピー」ボタンで介護ソフトへ貼り付けてください。
            </StepCard>
            <StepCard step={4} title="必要であれば保存する">
              「💾 保存」を押すと、作成した記録が
              <Link
                href="/records"
                className="mx-1 text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
              >
                記録一覧
              </Link>
              に残ります。あとから見返したり、コピー済みかどうかを管理したりできます。
            </StepCard>
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            記録一覧について
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            保存した記録は「未処理」「コピー済み」で絞り込めるほか、利用者名やメモの内容でも検索できます。介護ソフトへの貼り付けが終わったら「✅ コピー済みにする」を押すと、対応漏れを防げます。
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            記録をタップすると内容が開き、「✏️ 編集」で文章を直接修正、「🗑️ 削除」で記録そのものを消せます。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            AIに送る前の匿名化について
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            訪問メモをAIに送る直前に、人名・病院名・施設名・地名は自動的に伏せ字に置き換わります。画面や介護ソフトに貼り付ける文章には影響しません。
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            「〜病院」「〜デイサービス」のように種類がわかる言葉が付いていない固有名詞（施設の愛称など）は自動では拾えないことがあります。その場合は
            <Link
              href="/settings"
              className="mx-1 text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              辞書設定
            </Link>
            から個別に登録してください。登録した内容は自分のアカウントだけに使われます。
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
            ご利用にあたっての注意
          </h2>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
            AIが作成する文章はあくまで下書きです。誤りや不自然な表現が含まれる場合があるため、介護ソフトへ反映する前に必ず内容をご自身でご確認ください。
          </p>
        </section>
      </main>
    </div>
  );
}
