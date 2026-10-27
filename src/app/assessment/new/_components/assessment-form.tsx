"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { buildAssessmentText, choicesFor } from "@/lib/assessment/build";
import { dropUnavailable, toggleChoice } from "@/lib/assessment/selection";
import { ITEMS, SECTIONS, type Item, type SectionId, type Selections } from "@/lib/assessment/templates";

/** よく使う続柄。押すまでは何も登録しない */
const FAMILY_CANDIDATES = ["長女", "長男", "次女", "次男", "妻", "夫", "嫁"];

const LEAVE_MESSAGE = "入力した内容は消えます。よろしいですか？";

const itemDomId = (id: string) => `assessment-item-${id}`;

export default function AssessmentForm() {
  const [family, setFamily] = useState<string[]>([]);
  const [familyInput, setFamilyInput] = useState("");
  const [selections, setSelections] = useState<Selections>({});
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(true);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set(["kihon"]));
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  const result = useMemo(
    () => buildAssessmentText({ selections, family, includeUnconfirmed }),
    [selections, family, includeUnconfirmed],
  );

  const unconfirmedBySection = useMemo(() => {
    const counts = new Map<SectionId, number>();
    for (const id of result.unconfirmedIds) {
      const section = ITEMS.find((i) => i.id === id)!.section;
      counts.set(section, (counts.get(section) ?? 0) + 1);
    }
    return counts;
  }, [result.unconfirmedIds]);

  const isDirty = family.length > 0 || Object.keys(selections).length > 0;

  // 保存できないので、入力がある状態で画面を離れようとしたら確認する。
  // ・再読み込み／タブを閉じる／外のサイトへ移る → beforeunload
  // ・アプリ内のリンク（← トップ、メニュー）とログアウト → クリックを先に受け取って確認する
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const target = (event.target as Element | null)?.closest("a[href], [data-leaves-page]");
      if (!target) return;
      if (target instanceof HTMLAnchorElement) {
        if (target.target === "_blank") return;
        const url = new URL(target.href, location.href);
        if (url.origin === location.origin && url.pathname === location.pathname) return;
      }
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [isDirty]);

  // コピー完了の表示は少し置いてから元に戻す
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // 移動先の項目は少しのあいだ色を付けて目立たせる
  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(timer);
  }, [flashId]);

  function changeFamily(next: string[]) {
    setFamily(next);
    // 消した続柄を選んでいた項目は未選択に戻す
    setSelections((sel) => dropUnavailable(sel, ITEMS, next));
  }

  function addFamily(name: string) {
    const value = name.trim();
    if (value === "" || value === "家族" || family.includes(value)) return;
    changeFamily([...family, value]);
  }

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** 「未確認 ◯件 ▸」：閉じているセクションを開いてから、最初の未確認の項目まで移動する */
  function jumpToFirstUnconfirmed() {
    const first = ITEMS.find((i) => result.unconfirmedIds.includes(i.id));
    if (!first) return;
    // セクションを開いた結果が画面に出てから位置を測る
    flushSync(() => {
      setOpenSections((prev) => new Set(prev).add(first.section));
      setFlashId(first.id);
    });
    document.getElementById(itemDomId(first.id))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleCopy() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setCopyError("コピーできませんでした。文章を長押しして選択し、コピーしてください。");
    }
  }

  const unconfirmedSet = new Set(result.unconfirmedIds);

  return (
    <div className="flex flex-col gap-6">
      {/* ===== ご家族の続柄 ===== */}
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">ご家族の続柄</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            登録すると、家事や通院の付き添いなどの選択肢に出ます。登録しなければ「家族」と書かれます。
          </p>
        </div>

        {family.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="登録した続柄">
            {family.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => changeFamily(family.filter((f) => f !== name))}
                  aria-label={`${name}を消す`}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-teal-700 py-1 pr-2 pl-4 text-base font-bold text-white"
                >
                  {name}
                  <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-white/20 text-lg leading-none">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addFamily(familyInput);
            setFamilyInput("");
          }}
        >
          <label htmlFor="family-input" className="sr-only">
            続柄
          </label>
          <input
            id="family-input"
            value={familyInput}
            onChange={(event) => setFamilyInput(event.target.value)}
            maxLength={10}
            placeholder="例：長女"
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={familyInput.trim() === ""}
            className="min-h-12 shrink-0 rounded-lg bg-teal-700 px-4 text-base font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            ＋追加
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {FAMILY_CANDIDATES.filter((c) => !family.includes(c)).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addFamily(name)}
              className="min-h-11 rounded-full border border-teal-700 bg-white px-4 text-base font-medium text-teal-800 dark:border-teal-500 dark:bg-zinc-950 dark:text-teal-300"
            >
              ＋{name}
            </button>
          ))}
        </div>
      </section>

      {/* ===== 10セクション ===== */}
      <div className="flex flex-col gap-3">
        {SECTIONS.map((section) => {
          const open = openSections.has(section.id);
          const count = unconfirmedBySection.get(section.id) ?? 0;
          const items = ITEMS.filter((i) => i.section === section.id && !i.skipIf?.(selections));
          return (
            <section
              key={section.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                  aria-controls={`assessment-section-${section.id}`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
                >
                  <span className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    <span aria-hidden="true" className="w-4 text-base text-zinc-500">
                      {open ? "▼" : "▶"}
                    </span>
                    {section.title}
                  </span>
                  {count > 0 ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      未確認 {count}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      ✓ 入力済み
                    </span>
                  )}
                </button>
              </h2>

              {open && (
                <div
                  id={`assessment-section-${section.id}`}
                  className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
                >
                  {items.map((item) => (
                    <ItemField
                      key={item.id}
                      item={item}
                      family={family}
                      selections={selections}
                      unconfirmed={unconfirmedSet.has(item.id)}
                      flash={flashId === item.id}
                      onChange={(value) => setSelections((sel) => toggleChoice(sel, item, value))}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ===== できあがった文章 ===== */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">できあがった文章</h2>
        <label className="flex min-h-11 items-center gap-3 text-base text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={includeUnconfirmed}
            onChange={(event) => setIncludeUnconfirmed(event.target.checked)}
            className="size-6 accent-teal-700"
          />
          未確認の項目も文に入れる
        </label>
        <div aria-live="polite" className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {result.text === "" ? (
            <p className="text-base text-zinc-500 dark:text-zinc-400">まだ何も選ばれていません。</p>
          ) : (
            <p className="text-base leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{result.text}</p>
          )}
        </div>
        {copyError !== "" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {copyError}
          </p>
        )}
      </section>

      {/* 項目が多いので、未確認への移動とコピーは常に親指の届く画面下端に留めておく */}
      <div className="sticky bottom-0 -mx-4 -mb-6 flex items-center gap-2 border-t border-zinc-200 bg-zinc-50/80 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <button
          type="button"
          onClick={jumpToFirstUnconfirmed}
          disabled={result.unconfirmedCount === 0}
          className="flex min-h-14 flex-1 items-center justify-center rounded-xl border-2 border-amber-500 bg-amber-50 px-3 text-base font-bold text-amber-900 disabled:border-teal-600 disabled:bg-teal-50 disabled:text-teal-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200 dark:disabled:border-teal-500 dark:disabled:bg-teal-950 dark:disabled:text-teal-300"
        >
          {result.unconfirmedCount > 0 ? `未確認 ${result.unconfirmedCount}件 ▸` : "✓ 未確認なし"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={result.text === ""}
          className={`flex min-h-14 flex-1 items-center justify-center rounded-xl border px-3 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            copied
              ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          {copied ? "☑ コピーしました" : "📋 コピー"}
        </button>
      </div>
    </div>
  );
}

function ItemField({
  item,
  family,
  selections,
  unconfirmed,
  flash,
  onChange,
}: {
  item: Item;
  family: string[];
  selections: Selections;
  unconfirmed: boolean;
  flash: boolean;
  onChange: (value: string) => void;
}) {
  const raw = selections[item.id];
  const picked = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];

  return (
    <div
      id={itemDomId(item.id)}
      className={`flex scroll-mt-24 flex-col gap-3 px-4 py-4 transition-colors ${
        flash ? "bg-amber-100 dark:bg-amber-950" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{item.label}</h3>
        {item.type === "multi" && <span className="text-sm text-zinc-500 dark:text-zinc-400">複数選べます</span>}
        {item.optional && <span className="text-sm text-zinc-500 dark:text-zinc-400">（任意）</span>}
        {unconfirmed && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            未確認
          </span>
        )}
      </div>

      {item.type === "text" ? (
        <>
          <label htmlFor={`${itemDomId(item.id)}-input`} className="sr-only">
            {item.label}
          </label>
          <input
            id={`${itemDomId(item.id)}-input`}
            value={typeof raw === "string" ? raw : ""}
            onChange={(event) => onChange(event.target.value)}
            maxLength={40}
            placeholder={item.example ? `例：${item.example}` : undefined}
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {choicesFor(item, family).map((choice) => {
            const selected = picked.includes(choice.value);
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(choice.value)}
                className={`min-h-12 rounded-xl border-2 px-4 py-2 text-left text-base font-medium transition-colors ${
                  selected
                    ? "border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                }`}
              >
                {selected && <span aria-hidden="true">✓ </span>}
                {choice.value}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
