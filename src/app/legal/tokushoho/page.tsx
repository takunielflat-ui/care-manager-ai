import type { Metadata } from "next";

import { CONTACT_EMAIL } from "@/lib/sales";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | ケアマネAI",
};

const ON_REQUEST = "請求があった場合には遅滞なく開示いたします";

const ROWS: { label: string; value: string }[] = [
  { label: "販売事業者", value: ON_REQUEST },
  { label: "運営統括責任者", value: ON_REQUEST },
  { label: "所在地", value: "【DMMバーチャルオフィスの住所】" },
  { label: "電話番号", value: ON_REQUEST },
  { label: "メールアドレス", value: CONTACT_EMAIL },
  {
    label: "販売価格",
    value: "アセスメント機能：1,980円（税込、2026年12月31日までの先行価格）。2027年1月1日以降は3,980円（税込）",
  },
  { label: "商品代金以外の必要料金", value: "インターネット接続料金、通信料金はお客様のご負担となります" },
  { label: "お支払い方法", value: "クレジットカード（決済代行：Stripe）" },
  { label: "お支払い時期", value: "ご購入手続きの完了時にお支払いが確定します" },
  { label: "商品の提供時期", value: "決済完了後、24時間以内にご利用いただけるようにいたします（初回ログインが必要です）" },
  {
    label: "返品・キャンセル",
    value:
      "デジタルサービスの性質上、ご購入後の返金・キャンセルはお受けしておりません。ただし、当方の不具合によりご利用いただけない場合は、全額を返金いたします",
  },
  { label: "動作環境", value: "最新版の Google Chrome、Safari、Microsoft Edge（スマートフォン・パソコン）" },
];

export default function TokushohoPage() {
  return (
    <>
      <h1>特定商取引法に基づく表記</h1>
      <dl className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {ROWS.map((row) => (
          <div key={row.label} className="py-3">
            <dt className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{row.label}</dt>
            <dd className="mt-1 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
