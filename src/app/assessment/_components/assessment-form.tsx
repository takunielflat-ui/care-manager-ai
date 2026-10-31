"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { buildAssessmentText, choicesFor, splitSections } from "@/lib/assessment/build";
import { DISPLAY_NAME_MAX } from "@/lib/assessment/payload";
import { dropUnavailable, toggleChoice } from "@/lib/assessment/selection";
import {
  ITEMS,
  SECTIONS,
  TEMPLATE_VERSION,
  type Item,
  type SectionId,
  type Selections,
} from "@/lib/assessment/templates";

/** よく使う続柄。押すまでは何も登録しない */
const FAMILY_CANDIDATES = ["長女", "長男", "次女", "次男", "妻", "夫", "嫁"];

const LEAVE_MESSAGE = "保存していない内容は消えます。よろしいですか？";

/** ブラウザの「戻る」を受け止めるための履歴の目印（"base": 元の履歴、"guard": 足した履歴） */
const BACK_GUARD_KEY = "assessmentBackGuard";

const itemDomId = (id: string) => `assessment-item-${id}`;

/** 保存済みのアセスメント（編集画面で渡す） */
export type SavedAssessment = {
  id: string;
  displayName: string;
  assessedOn: string;
  family: string[];
  selections: Selections;
  includeUnconfirmed: boolean;
  generatedText: string;
  templateVersion: number;
};

type Snapshot = {
  displayName: string;
  assessedOn: string;
  family: string[];
  selections: Selections;
  includeUnconfirmed: boolean;
};

/** 「保存していない変更があるか」を比べるための文字列 */
const snapshotKey = (s: Snapshot) => JSON.stringify(s);

export default function AssessmentForm({
  saved,
  defaultDate,
}: {
  saved?: SavedAssessment;
  /** 新規作成のときの実施日の初期値（日本時間の今日） */
  defaultDate: string;
}) {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState(saved?.id ?? null);
  const [displayName, setDisplayName] = useState(saved?.displayName ?? "");
  const [assessedOn, setAssessedOn] = useState(saved?.assessedOn ?? defaultDate);
  const [family, setFamily] = useState<string[]>(saved?.family ?? []);
  const [familyInput, setFamilyInput] = useState("");
  // 保存後にテンプレートから消えた項目・選択肢は外しておく（そのままだと保存で受け付けられないため）
  const [selections, setSelections] = useState<Selections>(() =>
    saved ? dropUnavailable(saved.selections, ITEMS, saved.family) : {},
  );
  // 介護ソフトに貼る文章に【〇〇：未確認】が混ざらないよう、新規作成では最初は入れない。
  // 何が未確認かはセクションの見出しと「未確認 ◯件」で分かる。保存済みのものは保存時の設定に従う
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(saved?.includeUnconfirmed ?? false);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set(["kihon"]));
  /** コピーしたもの："all"（全部）またはセクション名。少し置いて null に戻す */
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");
  const [showSavedToast, setShowSavedToast] = useState(false);

  const current: Snapshot = { displayName, assessedOn, family, selections, includeUnconfirmed };
  const currentKey = snapshotKey(current);
  // 最後に保存した（または開いた）ときの状態。新規作成なら最初の空の状態
  const [savedKey, setSavedKey] = useState(() => currentKey);
  const isDirty = currentKey !== savedKey;

  const built = useMemo(
    () => buildAssessmentText({ selections, family, includeUnconfirmed }),
    [selections, family, includeUnconfirmed],
  );
  // 以前の版のテンプレートで保存したものは、何も変えていない間は保存した文章をそのまま見せる。
  // 選び直したら、今の版で作り直す。
  const showOldText = saved !== undefined && saved.templateVersion !== TEMPLATE_VERSION && !isDirty;
  const result = showOldText ? { ...built, text: saved.generatedText } : built;

  const unconfirmedBySection = useMemo(() => {
    const counts = new Map<SectionId, number>();
    for (const id of result.unconfirmedIds) {
      const section = ITEMS.find((i) => i.id === id)!.section;
      counts.set(section, (counts.get(section) ?? 0) + 1);
    }
    return counts;
  }, [result.unconfirmedIds]);

  const isDirtyRef = useRef(isDirty);
  /** 今いる履歴が「戻る」用のガードかどうか */
  const onBackGuardRef = useRef(false);
  /** 「戻る」の確認で OK して画面を離れる途中か */
  const leavingRef = useRef(false);

  // 保存していない変更がある状態で画面を離れようとしたら確認する。
  // ・再読み込み／タブを閉じる／外のサイトへ移る → beforeunload
  // ・アプリ内のリンク（← トップ、メニュー）とログアウト → クリックを先に受け取って確認する
  // ・ブラウザの「戻る」・スワイプ → 下の popstate の処理で確認する
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // 「戻る」の確認で OK 済みなら、外のサイトへ戻るときに二重に聞かない
      if (leavingRef.current) return;
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

  // ブラウザの「戻る」ボタン・スワイプで戻る → 同じURLの履歴を1つ足しておき（ガード）、
  // そこから元の履歴（ベース）へ戻られた（popstate）ときに確認する。
  // キャンセルなら「進む」でガードへ戻ってこの画面に留まる。ここで履歴を足し直すと、
  // Chrome は操作なしに足された履歴として次の「戻る」で飛ばしてしまうため、足し直さない。
  // ガードは保存後も残るため、変更がないときは何も聞かずにもう1つ戻り、戻る操作が1回で済むようにする。
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    // 別の画面から「戻る」でガードの履歴に戻ってきた場合も、ガードの上にいるものとして扱う
    onBackGuardRef.current = window.history.state?.[BACK_GUARD_KEY] === "guard";
    /** キャンセル後の「進む」で起きる popstate を読み飛ばすための印 */
    let returningToGuard = false;
    const onPopState = (event: PopStateEvent) => {
      if (returningToGuard) {
        returningToGuard = false;
        onBackGuardRef.current = true;
        event.stopImmediatePropagation();
        return;
      }
      if (!onBackGuardRef.current) return;
      onBackGuardRef.current = false;
      // ベースを飛ばして別の画面へ戻った場合は、ここでは何もせず Next.js に任せる
      if (window.history.state?.[BACK_GUARD_KEY] !== "base") return;
      // Next.js のルーターより先に受け取り、同じURLへの移動として処理させない
      event.stopImmediatePropagation();
      if (!isDirtyRef.current || window.confirm(LEAVE_MESSAGE)) {
        leavingRef.current = isDirtyRef.current;
        window.history.back();
      } else {
        returningToGuard = true;
        window.history.forward();
      }
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  useEffect(() => {
    if (!isDirty || onBackGuardRef.current) return;
    window.history.replaceState({ [BACK_GUARD_KEY]: "base" }, "");
    window.history.pushState({ [BACK_GUARD_KEY]: "guard" }, "");
    onBackGuardRef.current = true;
  }, [isDirty]);

  // コピー完了の表示は少し置いてから元に戻す
  useEffect(() => {
    if (!copiedKey) return;
    const timer = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedKey]);

  useEffect(() => {
    if (!showSavedToast) return;
    const timer = setTimeout(() => setShowSavedToast(false), 1500);
    return () => clearTimeout(timer);
  }, [showSavedToast]);

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

  async function handleCopy(text: string, key: string) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      setCopyError("コピーできませんでした。文章を長押しして選択し、コピーしてください。");
    }
  }

  async function handleSave() {
    setSaveError("");
    if (displayName.trim() === "") {
      setNameError("利用者の表示名（イニシャル）を入力してください。");
      document.getElementById("assessment-display-name")?.focus();
      return;
    }
    setNameError("");
    setIsSaving(true);
    try {
      const response = await fetch(assessmentId ? `/api/assessments/${assessmentId}` : "/api/assessments", {
        method: assessmentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setSaveError(data?.error ?? "保存に失敗しました。時間をおいてもう一度お試しください。");
        return;
      }
      setSavedKey(currentKey);
      setShowSavedToast(true);
      if (!assessmentId && typeof data?.id === "string") {
        // 新規作成のあとは編集画面のURLにする（そこから続けて上書き保存できる）
        setAssessmentId(data.id);
        // ガードの履歴の上なら目印を残す（「戻る」で新規作成の空の画面を挟まないため）
        window.history.replaceState(
          onBackGuardRef.current ? { [BACK_GUARD_KEY]: "guard" } : null,
          "",
          `/assessment/${data.id}`,
        );
      }
    } catch {
      setSaveError("保存に失敗しました。通信状態を確認して、もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!assessmentId) return;
    if (!window.confirm("このアセスメントを削除しますか？")) return;
    setSaveError("");
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setSaveError(data?.error ?? "削除に失敗しました。時間をおいてもう一度お試しください。");
        return;
      }
      // 削除したので「保存していない内容」の確認は出さずに一覧へ戻る
      setSavedKey(currentKey);
      router.push("/assessment");
      router.refresh();
    } catch {
      setSaveError("削除に失敗しました。通信状態を確認して、もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  }

  const unconfirmedSet = new Set(result.unconfirmedIds);

  return (
    <div className="flex flex-col gap-6">
      {showSavedToast && (
        <div
          role="status"
          className="fixed inset-x-0 top-20 z-50 mx-auto w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-base font-bold text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          保存しました
        </div>
      )}

      {/* ===== 利用者・実施日 ===== */}
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assessment-display-name" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            利用者の表示名
          </label>
          <input
            id="assessment-display-name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (event.target.value.trim() !== "") setNameError("");
            }}
            maxLength={DISPLAY_NAME_MAX}
            placeholder="A様"
            aria-invalid={nameError !== ""}
            aria-describedby="assessment-display-name-help"
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <p id="assessment-display-name-help" className="text-sm text-zinc-600 dark:text-zinc-400">
            実名ではなく、イニシャル等で入力してください（例：A様）。
          </p>
          {nameError !== "" && (
            <p role="alert" className="text-base font-bold text-red-700 dark:text-red-400">
              {nameError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assessment-date" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            実施日
          </label>
          <input
            id="assessment-date"
            type="date"
            value={assessedOn}
            onChange={(event) => setAssessedOn(event.target.value)}
            required
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </section>

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
        {showOldText && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[15px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            この文章は、以前の文章ルール（版{saved.templateVersion}）で保存したものです。選び直すと、今のルールで作り直します。
          </p>
        )}
        {/* 介護ソフトの欄ごとに貼り付けられるよう、セクションごとにコピーできる（見出しは含めない） */}
        {result.text === "" ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-base text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            まだ何も選ばれていません。
          </p>
        ) : (
          <ul aria-live="polite" className="flex flex-col gap-3">
            {splitSections(result.text).map(({ title, body }) => {
              const done = copiedKey === title;
              return (
                <li
                  key={title}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(body, title)}
                      aria-label={`${title}の文章をコピー`}
                      className={`min-h-11 shrink-0 rounded-lg border px-3 text-base font-bold transition-colors ${
                        done
                          ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {done ? "☑ コピーしました" : "📋 コピー"}
                    </button>
                  </div>
                  <p className="text-base leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{body}</p>
                </li>
              );
            })}
          </ul>
        )}
        {copyError !== "" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {copyError}
          </p>
        )}
      </section>

      {assessmentId && (
        <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="min-h-12 self-start rounded-lg border border-red-300 bg-white px-4 text-base font-bold text-red-700 disabled:opacity-40 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400"
          >
            {isDeleting ? "削除中..." : "🗑️ このアセスメントを削除"}
          </button>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">削除すると一覧に出なくなります。</p>
        </section>
      )}

      {saveError !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {saveError}
        </p>
      )}

      {/* 項目が多いので、未確認への移動・コピー・保存は常に親指の届く画面下端に留めておく。
          スマホ幅で3つ並ぶため、文字は小さくせず2行に折り返す */}
      <div className="sticky bottom-0 -mx-4 -mb-6 grid grid-cols-3 gap-2 border-t border-zinc-200 bg-zinc-50/80 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <button
          type="button"
          onClick={jumpToFirstUnconfirmed}
          disabled={result.unconfirmedCount === 0}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl border-2 border-amber-500 bg-amber-50 px-1 text-[15px] leading-tight font-bold text-amber-900 disabled:border-teal-600 disabled:bg-teal-50 disabled:text-teal-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200 dark:disabled:border-teal-500 dark:disabled:bg-teal-950 dark:disabled:text-teal-300"
        >
          {result.unconfirmedCount > 0 ? (
            <>
              <span>未確認</span>
              <span>{result.unconfirmedCount}件 ▸</span>
            </>
          ) : (
            "✓ 未確認なし"
          )}
        </button>
        <button
          type="button"
          onClick={() => handleCopy(result.text, "all")}
          disabled={result.text === ""}
          className={`flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 text-[15px] leading-tight font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            copiedKey === "all"
              ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          {copiedKey === "all" ? (
            <>
              <span>☑ コピー</span>
              <span>しました</span>
            </>
          ) : (
            <>
              <span>📋 全部</span>
              <span>コピー</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isDeleting || (assessmentId !== null && !isDirty)}
          aria-busy={isSaving}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-teal-700 px-1 text-[15px] leading-tight font-bold text-white shadow-lg shadow-teal-700/20 transition-all hover:bg-teal-800 active:bg-teal-900 disabled:bg-zinc-300 disabled:text-zinc-600 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
        >
          {isSaving ? "保存中..." : assessmentId !== null && !isDirty ? "✓ 保存済み" : "💾 保存"}
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
