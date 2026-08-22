import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "使い方｜介護サービス 単位数・自己負担シミュレーター",
  description: "単位数シミュレーターの使い方をご案内します。",
  alternates: {
    canonical: "/tools/tanni/help",
  },
};

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

export default function TanniHelpPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <Link
            href="/tools/tanni"
            className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
          >
            ← シミュレーターに戻る
          </Link>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">使い方</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            訪問先でその場で費用を出すための、簡単なご案内です。
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">このツールでできること</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            要介護度・地域・利用するサービスを入力すると、区分支給限度基準額との比較や、月々の自己負担の概算をその場で計算します。ログイン不要・無料で、計算結果はそのまま家族向けの画面表示や印刷用の紙にできます。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">基本の流れ</h2>
          <ol className="flex flex-col gap-3">
            <StepCard step={1} title="ご本人の条件を入力する">
              要介護度・負担割合(1〜3割)・地域区分を選びます。高額介護サービス費の区分も設定しておくと、上限を超えたときの払い戻し見込みまで自動で表示されます。
            </StepCard>
            <StepCard step={2} title="利用するサービスを追加する">
              「よく使うサービス」のチップをタップするか、「＋ その他のサービスを追加」から選びます。総合事業(要支援の訪問介護・通所介護など)のように、選んだ要介護度では使えないサービスはチップが薄く表示され、タップできません。
            </StepCard>
            <StepCard step={3} title="画面下のバーで金額を確認する">
              画面下に常に「今月の自己負担目安」と、区分支給限度基準額に対する使用率のバーが表示されます。バーをタップするとサービスごとの内訳が開きます。限度額を超えると赤く表示され、超過分が全額自己負担になることを知らせます。
            </StepCard>
            <StepCard step={4} title="家族に見せる・印刷する">
              金額の下にある「👨‍👩‍👧 家族に見せる画面」で、操作用のメニューを消した大きな表示に切り替えられます。「🖨 印刷用の紙を作る」では、結論とその計算のしかたをA4 1枚にまとめた印刷プレビューが作れます。お名前を入れても、この端末には保存されません。
            </StepCard>
            <StepCard step={5} title="（任意）事業所を登録しておく">
              右上の「事業所設定」から、よく使う事業所の規模・時間区分・処遇改善加算・自費項目をあらかじめ登録できます。次回からはサービスの行で事業所を選ぶだけで自動的に入力されます。登録内容はこの端末のブラウザにだけ保存されます。
            </StepCard>
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">数字の見方</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <b className="text-zinc-900 dark:text-zinc-50">単位</b>
            ：介護報酬の全国共通の値付け単位です。1単位あたりの金額は、お住まいの地域とサービスの種類によって決まります。
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <b className="text-zinc-900 dark:text-zinc-50">区分支給限度基準額</b>
            ：要介護度ごとに決まっている、1か月に介護保険で使える単位数の上限です。超えた分は全額自己負担になります。処遇改善加算はこの上限の対象外で、費用の計算にだけ加わります。
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <b className="text-zinc-900 dark:text-zinc-50">自費</b>
            ：食費・おむつ代・滞在費など、介護保険の対象外の支払いです。限度額とは関係なく、そのまま合計に加算されます。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">計算結果を保存したい場合</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            このページ単体では、入力したサービスの内容は保存されません(事業所設定を除く)。利用者ごとに試算を残したり、プランA・Bを比較したりしたい場合は
            <Link href="/login" className="mx-1 text-teal-700 underline-offset-2 hover:underline dark:text-teal-400">
              無料登録
            </Link>
            してください。
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">ご利用にあたっての注意</h2>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
            この試算は概算です。各種加算・減算や事業所独自の設定により、実際の金額とは差が出ます。ご契約前には必ず事業所の重要事項説明書・料金表をご確認ください。
          </p>
        </section>
      </main>
    </div>
  );
}
