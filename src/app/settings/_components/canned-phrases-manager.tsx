"use client";

import { useState } from "react";

export type CannedPhraseRow = {
  id: string;
  body: string;
  sort_order: number;
  created_at: string;
};

const MAX_CANNED_PHRASES = 20;

const FIELD_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:disabled:bg-zinc-800";

/** 一覧の並び順(sort_order昇順→created_at昇順)で揃える。 */
function sortPhrases(items: CannedPhraseRow[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at < b.created_at ? -1 : 1;
  });
}

function nextSortOrder(items: CannedPhraseRow[]) {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.sort_order)) + 1;
}

export default function CannedPhrasesManager({
  initialCannedPhrases,
}: {
  initialCannedPhrases: CannedPhraseRow[];
}) {
  const [cannedPhrases, setCannedPhrases] = useState(sortPhrases(initialCannedPhrases));
  const [body, setBody] = useState("");
  const [sortOrder, setSortOrder] = useState(() => nextSortOrder(initialCannedPhrases));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const reachedLimit = cannedPhrases.length >= MAX_CANNED_PHRASES;

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || body.trim() === "" || reachedLimit) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/canned-phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), sortOrder }),
      });

      const data: { cannedPhrase?: CannedPhraseRow; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.cannedPhrase) {
        setErrorMessage(data.error ?? "定型文の登録に失敗しました。");
        return;
      }

      const updated = sortPhrases([...cannedPhrases, data.cannedPhrase]);
      setCannedPhrases(updated);
      setBody("");
      setSortOrder(nextSortOrder(updated));
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId) return;

    setPendingDeleteId(id);
    setErrorMessage("");

    const previous = cannedPhrases;
    setCannedPhrases((current) => current.filter((item) => item.id !== id));

    try {
      const response = await fetch(`/api/canned-phrases/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
    } catch {
      setCannedPhrases(previous);
      setErrorMessage("削除に失敗しました。もう一度お試しください。");
    } finally {
      setPendingDeleteId(null);
    }
  }

  function startEdit(item: CannedPhraseRow) {
    setEditingId(item.id);
    setEditBody(item.body);
    setEditSortOrder(item.sort_order);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  async function saveEdit(item: CannedPhraseRow) {
    if (isSavingEdit || editBody.trim() === "") return;

    setIsSavingEdit(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/canned-phrases/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody.trim(), sortOrder: editSortOrder }),
      });

      const data: { cannedPhrase?: CannedPhraseRow; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.cannedPhrase) {
        setErrorMessage(data.error ?? "定型文の更新に失敗しました。");
        return;
      }

      setCannedPhrases((current) =>
        sortPhrases(current.map((it) => (it.id === item.id ? data.cannedPhrase! : it))),
      );
      setEditingId(null);
      setEditBody("");
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="phrase-body" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            本文
          </label>
          <textarea
            id="phrase-body"
            required
            rows={2}
            placeholder="例: 自宅を訪問し、本人と面談した。"
            disabled={isSubmitting || reachedLimit}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${FIELD_CLASS} w-full resize-y`}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="phrase-order" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              並び順
            </label>
            <input
              id="phrase-order"
              type="number"
              disabled={isSubmitting || reachedLimit}
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
              className={`${FIELD_CLASS} w-28`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || body.trim() === "" || reachedLimit}
            className="shrink-0 rounded-lg bg-teal-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            追加
          </button>
        </div>

        {reachedLimit && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            定型文は{MAX_CANNED_PHRASES}件まで登録できます。追加するには先に不要な定型文を削除してください。
          </p>
        )}
      </form>

      {errorMessage !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {cannedPhrases.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">未登録</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cannedPhrases.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {editingId === item.id ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    rows={2}
                    disabled={isSavingEdit}
                    className={`${FIELD_CLASS} w-full resize-y`}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        並び順
                      </label>
                      <input
                        type="number"
                        disabled={isSavingEdit}
                        value={editSortOrder}
                        onChange={(event) => setEditSortOrder(Number(event.target.value))}
                        className={`${FIELD_CLASS} w-28`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(item)}
                        disabled={isSavingEdit || editBody.trim() === ""}
                        className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSavingEdit ? "保存中..." : "保存"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSavingEdit}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-100">
                    {item.body}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label="編集"
                      className="rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={pendingDeleteId === item.id}
                      aria-label="削除"
                      className="rounded-full px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
