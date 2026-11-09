import type { Metadata } from "next";

import { CONTACT_EMAIL } from "@/lib/sales";

export const metadata: Metadata = {
  title: "プライバシーポリシー | ケアマネAI",
};

const SERVICES = [
  { name: "Supabase", use: "ログイン、データの保存" },
  { name: "Vercel", use: "サイトの配信" },
  { name: "Resend", use: "ログイン用メールの送信" },
  { name: "Stripe", use: "決済" },
  { name: "Anthropic", use: "経過記録の文章作成（モニター限定）" },
];

export default function PrivacyPage() {
  return (
    <>
      <h1>ケアマネAI プライバシーポリシー</h1>
      <p>ケアマネAI（以下「本サービス」）は、利用者の情報を次のとおり取り扱います。</p>

      <h2>1. 取得する情報</h2>
      <ul>
        <li>ログインに使うメールアドレス</li>
        <li>本サービスに入力された内容（アセスメントの選択結果、備考、利用者名の欄に入力されたイニシャル等）</li>
        <li>購入の記録（購入日、購入した機能）。クレジットカード番号は決済代行のStripeが取り扱い、本サービスは保持しません</li>
        <li>アクセスの記録（利用日時、ブラウザの種類など、障害対応に必要な範囲）</li>
      </ul>

      <h2>2. 利用目的</h2>
      <ul>
        <li>本サービスの提供、ログインの確認、購入された機能の提供</li>
        <li>お問い合わせへの対応、重要なお知らせの送付</li>
        <li>不具合の調査と改善</li>
      </ul>

      <h2>3. アセスメント機能で入力された内容の扱い</h2>
      <ul>
        <li>入力された内容は、外部のAIに送信しません</li>
        <li>保存されたアセスメントは、ご本人が削除するまで保管します。削除されたものは、約30日後に完全に消去します</li>
        <li>保存された内容は、ログインしたご本人だけが見られる設定にしています</li>
      </ul>

      <h2>4. 経過記録機能（モニター限定）で入力された内容の扱い</h2>
      <ul>
        <li>文章の作成にAI（Anthropic社のサービス）を利用します</li>
        <li>AIに送る前に、氏名や事業所名などを記号に置き換えます</li>
      </ul>

      <h2>5. 外部サービスの利用</h2>
      <p>本サービスは、次の外部サービスを利用しています。これらのサービスのサーバーは日本国外にある場合があります。</p>
      <table className="mt-3 w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
            <th className="py-2 pr-3 font-bold">サービス</th>
            <th className="py-2 font-bold">用途</th>
          </tr>
        </thead>
        <tbody>
          {SERVICES.map((service) => (
            <tr key={service.name} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2 pr-3 align-top">{service.name}</td>
              <td className="py-2">{service.use}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>6. 第三者への提供</h2>
      <p>法令に基づく場合を除き、ご本人の同意なく第三者に提供しません。</p>

      <h2>7. 安全管理</h2>
      <p>通信の暗号化、ログインした本人だけがデータを見られる設定など、必要な安全管理を行います。</p>

      <h2>8. 開示・訂正・削除のご請求</h2>
      <p>ご本人の情報の開示、訂正、削除をご希望の場合は、下記の窓口までご連絡ください。</p>

      <h2>9. お問い合わせ窓口</h2>
      <p className="break-all">{CONTACT_EMAIL}</p>

      <h2>10. 改定</h2>
      <p>本ポリシーを変更する場合は、本サービス上でお知らせします。</p>

      <p className="mt-8">制定：2026年11月【日】</p>
    </>
  );
}
