"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { 円, type 計算結果 } from "@/lib/kaigo/calc";
import { プランを計算, type プラン内容 } from "./plan-calc";
import { GaugeBar } from "./gauge";

type SavedPlan = { id: string; title: string; state: プラン内容; updated_at: string };
type Computed = { plan: SavedPlan; r: 計算結果 | null };

const 帯色 = (r: 計算結果) =>
  r.帯 === "over"
    ? "text-red-600 dark:text-red-400"
    : r.帯 === "caution"
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

function サービス名(r: 計算結果): string {
  if (r.details.length === 0) return "（サービスなし）";
  return r.details.map((d) => `${d.icon} ${d.label.replace(/（.*/, "")}`).join("・");
}

export default function TanniPlansView() {
  const [authState, setAuthState] = useState<"checking" | "in" | "out" | "error">("checking");
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user = null;
      try {
        const supabase = createClient();
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
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
      setLoading(true);
      try {
        const res = await fetch("/api/tanni-plans");
        const data: { plans?: SavedPlan[] } = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.plans) setPlans(data.plans);
        else if (!cancelled) setErrorMessage("保存済みの計算を読み込めませんでした。");
      } catch {
        if (!cancelled) setErrorMessage("通信に失敗しました。時間をおいて再度お試しください。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo<Computed[]>(
    () =>
      plans.map((plan) => {
        try {
          return { plan, r: プランを計算(plan.state) };
        } catch {
          return { plan, r: null };
        }
      }),
    [plans],
  );

  const 選択中 = useMemo(
    () => selectedIds.map((id) => computed.find((c) => c.plan.id === id)).filter(Boolean) as Computed[],
    [selectedIds, computed],
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2)));

  const handleDelete = async (id: string) => {
    if (busyId) return;
    if (!confirm("この保存を削除しますか？")) return;
    setBusyId(id);
    setErrorMessage("");
    const previous = plans;
    setPlans((cur) => cur.filter((p) => p.id !== id));
    setSelectedIds((cur) => cur.filter((x) => x !== id));
    try {
      const res = await fetch(`/api/tanni-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      setPlans(previous);
      setErrorMessage("削除に失敗しました。もう一度お試しください。");
    } finally {
      setBusyId(null);
    }
  };

  if (authState === "checking") {
    return <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">確認しています…</p>;
  }

  if (authState === "error") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
        接続を確認できませんでした。電波状況をご確認のうえ、ページを再読み込みしてください。
      </div>
    );
  }

  if (authState === "out") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
        保存した計算を見るにはログインが必要です。
        <Link
          href="/login"
          className="mt-3 block w-full rounded-xl bg-teal-700 py-3 text-center text-sm font-bold text-white"
        >
          ログイン / 無料登録
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">読み込んでいます…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          まだ保存がありません。
          <br />
          <Link href="/tools/tanni" className="mt-2 inline-block font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400">
            シミュレーターで計算して保存する →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{plans.length}件の保存</span>
            <button
              type="button"
              onClick={() => {
                setCompareMode((v) => !v);
                setSelectedIds([]);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold ${
                compareMode
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-teal-700 bg-white text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
              }`}
            >
              {compareMode ? "くらべるのをやめる" : "２件くらべる"}
            </button>
          </div>

          {compareMode && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-[12.5px] font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              くらべたい計算を2件えらんでください（{選択中.length}／2）
            </p>
          )}

          {compareMode && 選択中.length === 2 && <ComparePanel a={選択中[0]} b={選択中[1]} />}

          <div className="flex flex-col gap-3">
            {computed.map(({ plan, r }) => {
              const picked = selectedIds.includes(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border bg-white p-4 dark:bg-zinc-950 ${
                    picked
                      ? "border-teal-700 ring-1 ring-teal-700"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-zinc-900 dark:text-zinc-50">{plan.title}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {new Date(plan.updated_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                        {r ? `　/　${r.要介護度}` : ""}
                      </div>
                    </div>
                    {r && (
                      <div className="shrink-0 text-right">
                        <div className={`text-[19px] font-extrabold tabular-nums ${r.帯 === "over" ? "text-red-600 dark:text-red-400" : "text-teal-700 dark:text-teal-400"}`}>
                          {円(r.月額合計)}
                        </div>
                        <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400">今月の自己負担目安</div>
                      </div>
                    )}
                  </div>

                  {r ? (
                    <>
                      <div className="mt-2.5">
                        <GaugeBar r={r} />
                        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                          <span>
                            {r.給付管理単位.toLocaleString()} / {r.限度額.toLocaleString()} 単位
                          </span>
                          <span className={`font-bold ${帯色(r)}`}>{(r.使用率 * 100).toFixed(0)}％</span>
                        </div>
                      </div>
                      <div className="mt-2 line-clamp-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                        {サービス名(r)}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
                      この保存は内容を読み取れませんでした。
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    {compareMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(plan.id)}
                        className={`flex-1 rounded-lg border-[1.5px] py-2 text-[13px] font-bold ${
                          picked
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-teal-700 bg-white text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
                        }`}
                      >
                        {picked ? "選択中" : "くらべる対象にする"}
                      </button>
                    ) : (
                      <Link
                        href={`/tools/tanni?plan=${plan.id}`}
                        className="flex-1 rounded-lg bg-teal-700 py-2 text-center text-[13px] font-bold text-white"
                      >
                        電卓で開く
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(plan.id)}
                      disabled={busyId === plan.id}
                      className="shrink-0 rounded-lg border-[1.5px] border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-bold text-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CmpRow({
  k,
  a,
  b,
  diff,
  cls,
}: {
  k: string;
  a: string;
  b: string;
  diff?: string;
  cls?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-zinc-100 py-2 text-[13px] first:border-0 dark:border-zinc-800">
      <span className="text-zinc-500 dark:text-zinc-400">{k}</span>
      <b className={`text-right tabular-nums ${cls ?? ""}`}>{a}</b>
      <b className={`text-right tabular-nums ${cls ?? ""}`}>{b}</b>
      {diff !== undefined && (
        <span className="col-span-3 mt-0.5 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          差 {diff}
        </span>
      )}
    </div>
  );
}

function ComparePanel({ a, b }: { a: Computed; b: Computed }) {
  const ra = a.r;
  const rb = b.r;
  if (!ra || !rb) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-[13px] text-amber-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-amber-400">
        えらんだ計算のどちらかが読み取れないため、比較できません。
      </div>
    );
  }

  const 差額 = rb.月額合計 - ra.月額合計;
  const 差額文 =
    差額 === 0
      ? "同じ"
      : 差額 > 0
        ? `${b.plan.title} が ${円(差額)} 高い`
        : `${b.plan.title} が ${円(-差額)} 安い`;

  const yen = (n: number) => 円(n);
  const dyen = (n: number) => (n === 0 ? "±0" : (n > 0 ? "＋" : "−") + 円(Math.abs(n)));

  return (
    <div className="rounded-xl border-[1.5px] border-teal-700 bg-white p-4 dark:bg-zinc-950">
      <div className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">比較</div>
      <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 text-[12px] font-bold">
        <span className="text-zinc-500 dark:text-zinc-400">項目</span>
        <span className="max-w-[110px] truncate text-right text-teal-700 dark:text-teal-400">{a.plan.title}</span>
        <span className="max-w-[110px] truncate text-right text-teal-700 dark:text-teal-400">{b.plan.title}</span>
      </div>

      <div className="mt-1">
        <CmpRow k="今月の自己負担目安" a={yen(ra.月額合計)} b={yen(rb.月額合計)} diff={dyen(差額)} cls="text-[15px]" />
        <CmpRow
          k="自己負担（保険内）"
          a={yen(ra.介護保険分自己負担)}
          b={yen(rb.介護保険分自己負担)}
          diff={dyen(rb.介護保険分自己負担 - ra.介護保険分自己負担)}
        />
        <CmpRow
          k="限度額の超過分（全額負担）"
          a={yen(ra.超過自己負担)}
          b={yen(rb.超過自己負担)}
          diff={dyen(rb.超過自己負担 - ra.超過自己負担)}
          cls={ra.超過自己負担 || rb.超過自己負担 ? "text-red-600 dark:text-red-400" : undefined}
        />
        <CmpRow
          k="自費（食費など）"
          a={yen(ra.自費合計)}
          b={yen(rb.自費合計)}
          diff={dyen(rb.自費合計 - ra.自費合計)}
        />
        <CmpRow
          k="給付管理単位"
          a={`${ra.給付管理単位.toLocaleString()} / ${ra.限度額.toLocaleString()}`}
          b={`${rb.給付管理単位.toLocaleString()} / ${rb.限度額.toLocaleString()}`}
        />
        <CmpRow
          k="限度額の使用率"
          a={`${(ra.使用率 * 100).toFixed(0)}％`}
          b={`${(rb.使用率 * 100).toFixed(0)}％`}
        />
        <CmpRow k="要介護度" a={ra.要介護度} b={rb.要介護度} />
      </div>

      <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-[12.5px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
        {差額文}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] text-zinc-600 dark:text-zinc-400">
        <div>
          <div className="mb-1 font-bold text-zinc-500 dark:text-zinc-400">{a.plan.title} のサービス</div>
          {サービス名(ra)}
        </div>
        <div>
          <div className="mb-1 font-bold text-zinc-500 dark:text-zinc-400">{b.plan.title} のサービス</div>
          {サービス名(rb)}
        </div>
      </div>
    </div>
  );
}
