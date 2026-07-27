import VisitRecordForm from "./_components/visit-record-form";

// 訪問日の初期値にリクエスト時点の日付を使うため、ビルド時のプリレンダリングを避ける。
export const dynamic = "force-dynamic";

/**
 * `<input type="date">` 用の YYYY-MM-DD を日本時間で組み立てる。
 * サーバーの TZ に依存させないことで、ハイドレーション時のズレも防ぐ。
 */
function todayInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            訪問記録の入力
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            入力内容をもとに第5表（居宅介護支援経過）を作成します。
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <VisitRecordForm defaultVisitDate={todayInJapan()} />
      </main>
    </div>
  );
}
