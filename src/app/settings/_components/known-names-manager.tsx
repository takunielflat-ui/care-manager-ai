"use client";

import { useState } from "react";
import type { Category } from "@/lib/anonymize";

export type KnownNameRow = {
  id: string;
  category: Category;
  name: string;
  created_at: string;
};

const CATEGORY_LABELS: Record<Category, string> = {
  person: "人名",
  hospital: "病院名",
  facility: "施設名",
  place: "地名",
};

const CATEGORY_ORDER: Category[] = ["person", "hospital", "facility", "place"];

const FIELD_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:disabled:bg-zinc-800";

export default function KnownNamesManager({ initialKnownNames }: { initialKnownNames: KnownNameRow[] }) {
  const [knownNames, setKnownNames] = useState(initialKnownNames);
  const [category, setCategory] = useState<Category>("facility");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || name.trim() === "") return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/known-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name: name.trim() }),
      });

      const data: { knownName?: KnownNameRow; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !data.knownName) {
        setErrorMessage(data.error ?? "辞書への追加に失敗しました。");
        return;
      }

      setKnownNames((current) => [data.knownName!, ...current]);
      setName("");
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

    const previous = knownNames;
    setKnownNames((current) => current.filter((item) => item.id !== id));

    try {
      const response = await fetch(`/api/known-names/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
    } catch {
      setKnownNames(previous);
      setErrorMessage("削除に失敗しました。もう一度お試しください。");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            カテゴリ
          </label>
          <select
            id="category"
            value={category}
            disabled={isSubmitting}
            onChange={(event) => setCategory(event.target.value as Category)}
            className={FIELD_CLASS}
          >
            {CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            名称
          </label>
          <input
            id="name"
            type="text"
            required
            placeholder="例: ひまわり荘"
            disabled={isSubmitting}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${FIELD_CLASS} w-full`}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || name.trim() === ""}
          className="shrink-0 rounded-lg bg-teal-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          追加
        </button>
      </form>

      {errorMessage !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {CATEGORY_ORDER.map((value) => {
          const items = knownNames.filter((item) => item.category === value);
          return (
            <div key={value}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {CATEGORY_LABELS[value]}
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">未登録</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white py-1 pr-2 pl-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {item.name}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={pendingDeleteId === item.id}
                        aria-label={`${item.name}を削除`}
                        className="rounded-full px-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950 dark:hover:text-red-400"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
