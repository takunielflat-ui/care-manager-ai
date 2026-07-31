"use client";

import { useMemo, useState } from "react";

export type VisitRecord = {
  id: string;
  visit_date: string;
  display_name: string;
  note: string;
  generated_text: string;
  status: "pending" | "copied";
  created_at: string;
};

type Filter = "all" | "pending" | "copied";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "未処理" },
  { value: "copied", label: "コピー済み" },
];

/** 保存されている YYYY-MM-DD を「YYYY年M月D日」に整形する。 */
function formatVisitDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export default function RecordsList({ initialRecords }: { initialRecords: VisitRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const visibleRecords = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((record) => record.status === filter);
  }, [records, filter]);

  async function toggleStatus(record: VisitRecord) {
    if (pendingUpdateId) return;

    const nextStatus = record.status === "pending" ? "copied" : "pending";
    setPendingUpdateId(record.id);
    setErrorMessage("");

    // 楽観的更新。失敗したら元に戻す。
    setRecords((current) =>
      current.map((item) => (item.id === record.id ? { ...item, status: nextStatus } : item)),
    );

    try {
      const response = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("update failed");
      }
    } catch {
      setRecords((current) =>
        current.map((item) => (item.id === record.id ? { ...item, status: record.status } : item)),
      );
      setErrorMessage("ステータスの更新に失敗しました。もう一度お試しください。");
    } finally {
      setPendingUpdateId(null);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setErrorMessage("コピーできませんでした。手動で選択してコピーしてください。");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === item.value
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {errorMessage !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {visibleRecords.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          該当する記録がありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleRecords.map((record) => {
            const isExpanded = expandedId === record.id;
            const isCopied = record.status === "copied";

            return (
              <li
                key={record.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className="flex-1 text-left"
                  >
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {record.display_name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {formatVisitDate(record.visit_date)}
                    </p>
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      isCopied
                        ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {isCopied ? "コピー済み" : "未処理"}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <p className="text-base leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                      {record.generated_text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(record.generated_text)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        📋 コピー
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(record)}
                        disabled={pendingUpdateId === record.id}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {isCopied ? "未処理に戻す" : "✅ コピー済みにする"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
