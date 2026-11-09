import type { Metadata } from "next";
import Link from "next/link";

import { PURCHASE_URL } from "@/lib/sales";
import PublicFooter from "../../_components/public-footer";

export const metadata: Metadata = {
  title: "訪問中に、選ぶだけ。アセスメントの文章ができる。 | ケアマネAI",
  description: "スマホでポチポチ選んで、事務所のPCでコピー。あとは介護ソフトに貼るだけ。現役の主任ケアマネが作ったアセスメント作成ツールです。",
};

const PROBLEMS = [
  "訪問メモを見返しながら、アセスメントを一から書いている",
  "「自立」「見守り」の書き方が、人や日によってばらばら",
  "事務所に戻ってから思い出せず、書く手が止まる",
];

const STEPS = [
  { title: "訪問中に選ぶ", body: "スマホで、移動・食事・排泄などの項目をボタンで選ぶ" },
  { title: "保存する", body: "選んだ内容から、短い文章が自動でできる" },
  { title: "事務所でコピー", body: "PCで一覧から開いて、介護ソフトに貼り付ける" },
];

const FEATURES = [
  "基本動作・移動・食事・口腔・排泄・入浴・更衣・服薬・家事・認知の10項目",
  "屋内と屋外で違う補助具も、それぞれ選べる",
  "住宅型有料・サ高住の方にも使える選択肢",
  "家族は「長女」「夫」など続柄で書ける",
  "まだ確認していない項目が一目で分かる",
  "選択肢にないことは備考に書ける",
  "更新のときは、前回の内容を開いて付け足せる",
];

const REASONS = [
  { title: "外部のAIに送りません", body: "選んだ内容から、決まったルールで文章を作ります" },
  { title: "いつでも自分で削除できます", body: "削除したものは、約30日後にサーバーからも消えます" },
  { title: "自分の分しか見られません", body: "ほかの人の入力内容は見えない仕組みです" },
  { title: "利用者名はイニシャルで", body: "氏名を入れなくても使えます" },
];

const PRICE_NOTES = [
  "一度の購入で、ずっと使えます（サービス提供期間中）",
  "選択肢の追加や制度改正への対応も、追加料金なし",
  "先行価格で購入された方は、今後価格が上がっても追加料金はかかりません",
];

const FAQS = [
  { q: "月額料金はかかりますか？", a: "かかりません。買い切りです。" },
  { q: "先行価格はいつまでですか？", a: "2026年12月31日までのご購入が対象です。2027年1月1日から3,980円になります。" },
  { q: "どの介護ソフトで使えますか？", a: "文章をコピーして貼り付けるので、介護ソフトの種類を問いません。" },
  { q: "パソコンだけでも使えますか？", a: "使えます。スマホとパソコンのどちらでも、同じアカウントで使えます。" },
  { q: "購入後、すぐに使えますか？", a: "決済完了から24時間以内に使えるようにします。購入時のメールアドレスで、一度ログインしてお待ちください。" },
  { q: "返金はできますか？", a: "デジタルサービスのため、購入後の返金はお受けしていません。不具合で使えない場合は全額返金します。" },
  { q: "ログインのメールが届きません。", a: "迷惑メールフォルダもご確認ください。それでも届かない場合は、お問い合わせください。" },
];

const HEADING = "text-lg font-bold text-zinc-900 dark:text-zinc-100";
const CARD = "rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950";

/** アセスメント機能の紹介ページ。ログインなしで見られる（proxy.ts） */
export default function AssessmentLandingPage() {
  const isPurchaseReady = !PURCHASE_URL.startsWith("#");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <span className="font-bold text-teal-700 dark:text-teal-400">ケアマネAI</span>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg border border-teal-700 px-4 font-bold text-teal-700 dark:border-teal-500 dark:text-teal-400"
          >
            ログイン
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 py-8 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <section className="flex flex-col gap-3">
          <h1 className="text-2xl leading-snug font-bold text-zinc-900 dark:text-zinc-100">
            訪問中に、選ぶだけ。
            <br />
            アセスメントの文章ができる。
          </h1>
          <p>スマホでポチポチ選んで、事務所のPCでコピー。あとは介護ソフトに貼るだけ。</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>こんなことありませんか？</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {PROBLEMS.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>使い方は3ステップ</h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className={CARD}>
                <p className="font-bold text-teal-700 dark:text-teal-400">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-1">{step.body}</p>
              </li>
            ))}
          </ol>
          {/* デモ動画ができたら、この枠を置き換える */}
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
            デモ動画は準備中です
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>できること</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {FEATURES.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>安心して使える理由</h2>
          <ul className="flex flex-col gap-3">
            {REASONS.map((reason) => (
              <li key={reason.title} className={CARD}>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{reason.title}</p>
                <p className="mt-1">{reason.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>現役の主任ケアマネが作りました</h2>
          <p>現場で「書く時間を減らしたい」と思って作った道具です。使う人の声を聞いて、選択肢を増やしていきます。</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>料金</h2>
          <div className="flex flex-col gap-3 rounded-lg border-2 border-teal-700 bg-white px-4 py-4 dark:border-teal-500 dark:bg-zinc-950">
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">公開記念の先行価格 1,980円（税込・買い切り）</p>
            <p>2026年12月31日までのご購入が対象です。2027年1月1日からは3,980円（税込）になります。</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {PRICE_NOTES.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <a
              href={PURCHASE_URL}
              className="flex min-h-14 items-center justify-center rounded-xl bg-teal-700 px-4 text-lg font-bold text-white hover:bg-teal-800"
            >
              購入する
            </a>
            {!isPurchaseReady && (
              <p id="purchase-pending" className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                ご購入の受付は準備中です。
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={HEADING}>よくある質問</h2>
          <dl className="flex flex-col gap-3">
            {FAQS.map((faq) => (
              <div key={faq.q} className={CARD}>
                <dt className="font-bold text-zinc-900 dark:text-zinc-100">Q. {faq.q}</dt>
                <dd className="mt-1">A. {faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
