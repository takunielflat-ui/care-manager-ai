"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:disabled:bg-zinc-800";

const LABEL_CLASS = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const DRAFT_KEY = "care-manager-ai:visit-record-draft";

export default function VisitRecordForm({
  defaultVisitDate,
}: {
  defaultVisitDate: string;
}) {
  const [visitDate, setVisitDate] = useState(defaultVisitDate);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const resultRef = useRef<HTMLElement>(null);

  // ブラウザが閉じても入力内容が消えないよう、下書きをlocalStorageに保存・復元する。
  // 復元前の空の状態で上書き保存してしまわないよう、復元完了後にのみ保存effectを動かす。
  // サーバー側にはlocalStorageが無いため、マウント後にのみ読み込める（＝effectでの復元が必須）。
  /* eslint-disable react-hooks/set-state-in-effect -- localStorageからのマウント時復元は例外的に許容される用途 */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: Partial<{ visitDate: string; displayName: string; note: string }> =
          JSON.parse(raw);
        if (typeof draft.visitDate === "string") setVisitDate(draft.visitDate);
        if (typeof draft.displayName === "string") setDisplayName(draft.displayName);
        if (typeof draft.note === "string") setNote(draft.note);
      }
    } catch {
      // 壊れた下書きは無視する
    }
    setIsDraftLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isDraftLoaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ visitDate, displayName, note }));
    } catch {
      // 保存できなくても入力自体には影響しないので無視する
    }
  }, [isDraftLoaded, visitDate, displayName, note]);

  // メモ欄が画面を占めるので、生成開始後に本文が見える位置まで送る。
  // 出力欄が描画されてからでないとスクロールできないため、コミット後に実行する。
  useEffect(() => {
    if (!isGenerating) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isGenerating]);

  // コピー完了の表示は少し置いてから元に戻す
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const canSubmit = note.trim() !== "" && !isGenerating;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) return;

    setIsGenerating(true);
    setErrorMessage("");
    setResult("");
    setCopied(false);
    setSavedRecordId(null);
    setSaveErrorMessage("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitDate, displayName, note }),
      });

      // 生成が始まる前の失敗は、通常の JSON エラーとして返る
      if (!response.ok || !response.body) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        setErrorMessage(data.error ?? "第5表の作成に失敗しました。");
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let text = "";

      // NDJSON を1行ずつ読み、delta が届くたびに画面へ流し込む
      const consumeLine = (line: string) => {
        if (line.trim() === "") return;
        let parsed: { type?: string; text?: string; message?: string };
        try {
          parsed = JSON.parse(line);
        } catch {
          return; // 壊れた行は捨てる
        }
        if (parsed.type === "delta" && parsed.text) {
          text += parsed.text;
          setResult(text);
        } else if (parsed.type === "error") {
          setErrorMessage(parsed.message ?? "第5表の作成に失敗しました。");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 最後の要素は未完成の行
        for (const line of lines) consumeLine(line);
      }
      consumeLine(buffer);

      if (text === "") {
        setErrorMessage((current) =>
          current === "" ? "AIから本文が返りませんでした。もう一度お試しください。" : current,
        );
      }
    } catch {
      setErrorMessage("通信に失敗しました。電波状況をご確認ください。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setErrorMessage("コピーできませんでした。手動で選択してコピーしてください。");
    }
  }

  async function handleSave() {
    if (isSaving || savedRecordId) return;

    setIsSaving(true);
    setSaveErrorMessage("");

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitDate, displayName, note, generatedText: result }),
      });

      const data: { id?: string; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !data.id) {
        setSaveErrorMessage(data.error ?? "記録の保存に失敗しました。");
        return;
      }

      setSavedRecordId(data.id);
    } catch {
      setSaveErrorMessage("通信に失敗しました。電波状況をご確認の上もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="visit-date" className={LABEL_CLASS}>
          訪問日
        </label>
        <input
          id="visit-date"
          name="visit_date"
          type="date"
          required
          disabled={isGenerating}
          value={visitDate}
          onChange={(event) => setVisitDate(event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="display-name" className={LABEL_CLASS}>
          利用者表示名
        </label>
        <input
          id="display-name"
          name="display_name"
          type="text"
          required
          autoComplete="off"
          placeholder="A様"
          disabled={isGenerating}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={FIELD_CLASS}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          実名で入力して構いません。AIへの送信時は自動的に匿名化されます。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="note" className={LABEL_CLASS}>
          訪問メモ
        </label>
        <textarea
          id="note"
          name="note"
          required
          rows={16}
          placeholder="訪問時の様子、本人・家族の発言、気づいたことなどを自由に入力してください。"
          disabled={isGenerating}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={`${FIELD_CLASS} min-h-[55vh] resize-y leading-relaxed sm:min-h-[24rem]`}
        />
      </div>

      {errorMessage !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {(result !== "" || isGenerating) && (
        <section ref={resultRef} className="flex flex-col gap-3 scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              第5表（居宅介護支援経過）
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isGenerating || isSaving || result === "" || savedRecordId !== null}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  savedRecordId !== null
                    ? "border-teal-600 bg-teal-50 text-teal-800 opacity-100 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {savedRecordId !== null ? "✅ 保存しました" : isSaving ? "保存中..." : "💾 保存"}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={isGenerating || result === ""}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  copied
                    ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {copied ? "☑ コピーしました" : "📋 コピー"}
              </button>
            </div>
          </div>

          {saveErrorMessage !== "" && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {saveErrorMessage}
            </p>
          )}

          {savedRecordId !== null && (
            <p className="text-sm text-teal-700 dark:text-teal-400">
              記録を保存しました。
              <Link href="/records" className="ml-1 underline-offset-2 hover:underline">
                記録一覧を見る →
              </Link>
            </p>
          )}
          <div
            aria-live="polite"
            aria-busy={isGenerating}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {result === "" ? (
              <p className="text-base text-zinc-500 dark:text-zinc-400">
                🤖 考えをまとめています...
              </p>
            ) : (
              <p className="text-base leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                {result}
                {isGenerating && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] animate-pulse bg-teal-600 dark:bg-teal-400"
                  />
                )}
              </p>
            )}
          </div>
          {!isGenerating && result !== "" && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              AIが生成した下書きです。記録として使う前に必ず内容をご確認ください。
            </p>
          )}
        </section>
      )}

      {/* メモ欄が長いので、ボタンは常に親指の届く画面下端に留めておく */}
      <div className="sticky bottom-0 -mx-4 -mb-6 border-t border-zinc-200 bg-zinc-50/80 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-5 text-lg font-bold text-white shadow-lg shadow-teal-700/20 transition-all hover:bg-teal-800 active:scale-[0.99] active:bg-teal-900 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          {isGenerating ? (
            <>
              <span
                aria-hidden="true"
                className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              🤖 AIが作成中...
            </>
          ) : (
            "✨ 第5表を作成"
          )}
        </button>
      </div>
    </form>
  );
}
