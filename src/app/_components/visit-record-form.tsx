"use client";

import { useState } from "react";

export default function VisitRecordForm({
  defaultVisitDate,
}: {
  defaultVisitDate: string;
}) {
  const [visitDate, setVisitDate] = useState(defaultVisitDate);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");

  const canSubmit = visitDate !== "" && displayName.trim() !== "" && note.trim() !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: AI 連携（第5表生成）と Supabase 保存をここに繋ぐ
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="visit-date"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          訪問日
        </label>
        <input
          id="visit-date"
          name="visit_date"
          type="date"
          required
          value={visitDate}
          onChange={(event) => setVisitDate(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="display-name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          利用者表示名
        </label>
        <input
          id="display-name"
          name="display_name"
          type="text"
          required
          autoComplete="off"
          placeholder="A様"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          個人が特定されない表示名を入力してください。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="note"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          訪問メモ
        </label>
        <textarea
          id="note"
          name="note"
          required
          rows={16}
          placeholder="訪問時の様子、本人・家族の発言、気づいたことなどを自由に入力してください。"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-[55vh] w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base leading-relaxed text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 sm:min-h-[24rem] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      {/* メモ欄が長いので、ボタンは常に親指の届く画面下端に留めておく */}
      <div className="sticky bottom-0 -mx-4 -mb-6 border-t border-zinc-200 bg-zinc-50/80 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-teal-700 px-4 py-5 text-lg font-bold text-white shadow-lg shadow-teal-700/20 transition-all hover:bg-teal-800 active:scale-[0.99] active:bg-teal-900 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          ✨ 第5表を作成
        </button>
      </div>
    </form>
  );
}
