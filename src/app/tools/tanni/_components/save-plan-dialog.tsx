"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { 行state, 条件 } from "./state";

/**
 * サーバーに保存する計算の中身。
 * ★利用者の実名（印刷名）はここに入れない。PDFへの名前の差し込みは端末内だけで行い、
 *   サーバー（運営者を含む）には一切送らない。古い保存データには入っている場合がある。
 */
export interface TanniPlanState extends 条件 {
  印刷名?: string;
  超過割当?: number | null;
  rows: 行state[];
}

type PlanSummary = { id: string; title: string; updated_at: string };

/** 電卓でいま開いている保存済みの計算（上書き保存の対象） */
export type 開いている計算 = PlanSummary;

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export default function SavePlanDialog({
  open,
  onClose,
  currentState,
  openPlan,
  onLoad,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  currentState: TanniPlanState;
  openPlan: 開いている計算 | null;
  onLoad: (state: TanniPlanState, plan: 開いている計算) => void;
  /** 保存（上書き・新規）できたとき。saved はそのとき保存した中身 */
  onSaved: (plan: 開いている計算, saved: TanniPlanState) => void;
  onDeleted: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="tanni-dialog-chrome mx-auto mt-auto mb-0 max-h-[92vh] w-full max-w-[640px] rounded-t-2xl border-0 bg-zinc-50 p-0 text-zinc-900 backdrop:bg-black/45 dark:bg-black dark:text-zinc-50"
    >
      <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-teal-900 px-4 py-3.5 text-white">
        <b className="flex-1 text-[15px]">計算結果の保存</b>
        <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          閉じる
        </button>
      </div>

      {/* 開くたびに再マウントさせ、認証確認とプラン一覧取得をやり直す */}
      {open && (
        <SavePlanDialogBody
          currentState={currentState}
          openPlan={openPlan}
          onLoad={onLoad}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}

function SavePlanDialogBody({
  currentState,
  openPlan,
  onLoad,
  onSaved,
  onDeleted,
  onClose,
}: {
  currentState: TanniPlanState;
  openPlan: 開いている計算 | null;
  onLoad: (state: TanniPlanState, plan: 開いている計算) => void;
  onSaved: (plan: 開いている計算, saved: TanniPlanState) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [authState, setAuthState] = useState<"checking" | "in" | "out" | "error">("checking");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  // 実名をサーバーに送らないため、PDF用のお名前を保存名の初期値に使わない
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user = null;
      try {
        const supabase = createClient();
        // 環境変数の未設定や通信断で getUser() が返らないと、
        // 「確認しています…」から進まなくなる。8秒で打ち切ってエラー表示にする。
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000),
          ),
        ]);
        user = result.data.user;
      } catch {
        if (!cancelled) setAuthState("error");
        return;
      }
      if (cancelled) return;

      if (!user) {
        setAuthState("out");
        return;
      }
      setAuthState("in");
      setPlansLoading(true);
      try {
        const res = await fetch("/api/tanni-plans");
        const data: { plans?: PlanSummary[] } = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.plans) setPlans(data.plans);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (saving || title.trim() === "") return;
    setSaving(true);
    setErrorMessage("");
    try {
      // 印刷名（利用者の実名）は送らない
      const { 印刷名: _除外, ...state } = currentState;
      void _除外;
      const res = await fetch("/api/tanni-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), state }),
      });
      const data: { plan?: PlanSummary; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) {
        setErrorMessage(data.error ?? "保存に失敗しました。");
        return;
      }
      setPlans((cur) => [data.plan!, ...cur]);
      // 新しく保存したら、以後はその計算を開いている扱いにする（次からは上書きできる）
      onSaved(data.plan, currentState);
      onClose();
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handleOverwrite = async () => {
    if (saving || !openPlan) return;
    setSaving(true);
    setErrorMessage("");
    try {
      // 印刷名（利用者の実名）は送らない
      const { 印刷名: _除外, ...state } = currentState;
      void _除外;
      const res = await fetch(`/api/tanni-plans/${openPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data: { plan?: PlanSummary; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) {
        setErrorMessage(data.error ?? "上書き保存に失敗しました。");
        return;
      }
      onSaved(data.plan, currentState);
      onClose();
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/tanni-plans/${id}`);
      const data: { plan?: PlanSummary & { state: TanniPlanState }; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.plan) {
        setErrorMessage(data.error ?? "読み込みに失敗しました。");
        return;
      }
      const { state, ...meta } = data.plan;
      onLoad(state, meta);
      onClose();
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busyId) return;
    if (!confirm("このプランを削除しますか？")) return;
    setBusyId(id);
    setErrorMessage("");
    const previous = plans;
    setPlans((cur) => cur.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/tanni-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDeleted(id);
    } catch {
      setPlans(previous);
      setErrorMessage("削除に失敗しました。もう一度お試しください。");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto p-3.5">
      {authState === "checking" && (
        <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">確認しています…</div>
      )}

      {authState === "error" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
          接続を確認できませんでした。電波状況をご確認のうえ、いったん「閉じる」を押して、もう一度お試しください。
        </div>
      )}

      {authState === "out" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
          保存にはログインが必要です。ログインすると、利用者ごとに計算結果を保存していつでも呼び出せます。
          <Link
            href="/login"
            className="mt-3 block w-full rounded-xl bg-teal-700 py-3 text-center text-[14px] font-bold text-white"
          >
            ログイン / 無料登録
          </Link>
        </div>
      )}

      {authState === "in" && (
        <>
          {openPlan && (
            <div className="mb-3 rounded-xl border-[1.5px] border-teal-700 bg-white p-3.5 dark:bg-zinc-950">
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">いま開いている計算</div>
              <div className="mt-0.5 truncate font-bold">{openPlan.title}</div>
              <button
                type="button"
                onClick={handleOverwrite}
                disabled={saving}
                className="mt-2.5 w-full rounded-xl bg-teal-700 py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {saving ? "保存中…" : "💾 上書き保存"}
              </button>
              <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                「{openPlan.title}」を今の内容で置き換えます。元の内容も残したいときは、下の「別の名前で保存」を使ってください。
              </div>
            </div>
          )}

          <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            {openPlan && (
              <div className="mb-2 text-[13px] font-bold text-zinc-700 dark:text-zinc-300">別の名前で保存</div>
            )}
            <label className="mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400">
              プラン名（実名は入れないでください）
            </label>
            <input
              className={inputCls}
              value={title}
              placeholder="例）No.12 プランA／Aさん 通所追加案"
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || title.trim() === ""}
              className={`mt-2.5 w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50 ${
                openPlan
                  ? "border-[1.5px] border-teal-700 bg-white text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
                  : "bg-teal-700 text-white"
              }`}
            >
              {saving ? "保存中…" : openPlan ? "別の計算として新しく保存" : "この内容を新しく保存"}
            </button>
            <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              新しいプランとして追加されます。プランA/Bの比較にご利用ください。
              <br />
              プラン名はサーバーに保存されるため、利用者のお名前は入れず、事業所内の番号やイニシャルなどで区別してください。PDFに印字するお名前は保存されません（印刷のたびにこの端末で入力します）。
            </div>
          </div>

          {errorMessage && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {errorMessage}
            </p>
          )}

          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h3 className="text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">
              保存済みのプラン
            </h3>
            <Link
              href="/tools/tanni/plans"
              className="shrink-0 text-[12px] font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              一覧・比較ページ →
            </Link>
          </div>
          {plansLoading ? (
            <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">読み込んでいます…</div>
          ) : plans.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">まだ保存がありません。</div>
          ) : (
            plans.map((p) => (
              <div
                key={p.id}
                className="mb-2 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  {openPlan?.id === p.id && (
                    <span className="mb-0.5 inline-block rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                      いま開いている
                    </span>
                  )}
                  <div className="truncate font-bold">{p.title}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {new Date(p.updated_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoad(p.id)}
                  disabled={busyId === p.id}
                  className="shrink-0 rounded-full bg-teal-50 px-3 py-1.5 text-[12px] font-bold text-teal-700 disabled:opacity-50 dark:bg-teal-950 dark:text-teal-400"
                >
                  読み込む
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={busyId === p.id}
                  className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-bold text-zinc-500 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  削除
                </button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
