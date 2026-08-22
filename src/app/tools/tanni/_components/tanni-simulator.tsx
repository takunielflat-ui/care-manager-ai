"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  MASTER_VERSION,
  自費プリセット,
  地域区分,
  要介護度一覧,
  高額介護サービス費,
  type 要介護度,
} from "@/lib/kaigo/master";
import { 計算 } from "@/lib/kaigo/calc";
import ServiceRow from "./service-row";
import QuickAdd from "./quick-add";
import SummarySheet from "./summary-sheet";
import FamilyDialog from "./family-dialog";
import PrintDialog from "./print-dialog";
import JigyoshoDialog from "./jigyosho-dialog";
import {
  applyJigyosho,
  loadCond,
  loadJigyosho,
  newRow,
  saveCond,
  saveJigyosho,
  uid,
  要介護度に合わせて行を直す,
  type AppState,
  type 事業所,
  type 行state,
} from "./state";

const pillCls = (on: boolean) =>
  `flex-1 min-w-[52px] rounded-lg border px-1.5 py-2.5 text-sm font-bold ${
    on
      ? "border-teal-700 bg-teal-700 text-white"
      : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
  }`;
const selectCls =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelCls = "mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400";

/**
 * 初期状態を1回だけ計算する。localStorageはサーバーでは読めないため
 * loadCond/loadJigyosho は window 未定義時に既定値を返す（state.ts参照）。
 * このズレは #hydrated ゲートで吸収し（マウントするまで何も描画しない）、
 * ハイドレーション不一致を起こさない。
 */
function 初期状態を作る(): AppState {
  const cond = loadCond();
  const jigyosho = loadJigyosho();
  const seq = 1;
  const rows = [newRow(seq, jigyosho)];
  return { ...cond, 印刷名: "", rows, jigyosho, seq: seq + 1 };
}

const noopSubscribe = () => () => {};

export default function TanniSimulator() {
  const [state, setState] = useState<AppState>(初期状態を作る);
  // サーバーでは false、クライアントの初回コミット以降は true。
  // setState を使わずに済む useSyncExternalStore の定番パターンで、
  // ハイドレーション不一致を起こさずに「マウント済みか」を判定する。
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [famOpen, setFamOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [jigyoshoOpen, setJigyoshoOpen] = useState(false);

  const 高額上限 = useMemo(
    () => 高額介護サービス費.find((k) => k.id === state.高額区分)?.上限 ?? null,
    [state.高額区分],
  );

  const result = useMemo(
    () =>
      計算({
        要介護度: state.要介護度,
        地域区分: state.地域区分,
        負担割合: state.負担割合,
        高額上限,
        rows: state.rows.map((x) => ({
          id: x.id,
          service: x.service,
          軸1: x.軸1,
          軸2: x.軸2,
          manualUnits: x.manualUnits,
          月回数: x.月回数,
          処遇改善区分: x.処遇改善区分,
          加算率上書き: x.加算率上書き,
          自費: x.自費,
        })),
      }),
    [state.要介護度, state.地域区分, state.負担割合, 高額上限, state.rows],
  );

  const setDegree = (度: 要介護度) =>
    setState((s) => {
      const next = { ...s, 要介護度: 度, rows: 要介護度に合わせて行を直す(s.rows, 度) };
      saveCond(next);
      return next;
    });
  const setBurden = (v: number) =>
    setState((s) => {
      const next = { ...s, 負担割合: v };
      saveCond(next);
      return next;
    });
  const setArea = (id: string) =>
    setState((s) => {
      const next = { ...s, 地域区分: id };
      saveCond(next);
      return next;
    });
  const setKogaku = (id: string) =>
    setState((s) => {
      const next = { ...s, 高額区分: id };
      saveCond(next);
      return next;
    });
  const setPrintName = (v: string) => setState((s) => ({ ...s, 印刷名: v }));
  const setPrintBy = (v: string) =>
    setState((s) => {
      const next = { ...s, 印刷作成者: v };
      saveCond(next);
      return next;
    });

  const addRow = (preset?: Parameters<typeof newRow>[2]) =>
    setState((s) => ({ ...s, rows: [...s.rows, newRow(s.seq, s.jigyosho, preset)], seq: s.seq + 1 }));
  const removeRow = (id: number) => setState((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
  const updateRow = (id: number, patch: Partial<行state>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const selectRowJigyosho = (id: number, jid: string) =>
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === id ? applyJigyosho(r, s.jigyosho, jid || null) : r)),
    }));
  const clearAllRows = () => setState((s) => ({ ...s, rows: [] }));

  const openJigyoshoDialog = () => setJigyoshoOpen(true);
  const addJigyosho = () =>
    setState((s) => ({
      ...s,
      jigyosho: [
        ...s.jigyosho,
        {
          id: uid(),
          name: "",
          service: "通所リハビリテーション",
          軸1: "通常規模型",
          軸2: "6時間以上7時間未満",
          処遇改善区分: "Ⅰイ",
          自費: [],
          _open: true,
        },
      ],
    }));
  const updateJigyosho = (id: string, patch: Partial<事業所>) =>
    setState((s) => {
      const jigyosho = s.jigyosho.map((j) => (j.id === id ? { ...j, ...patch } : j));
      const next = { ...s, jigyosho };
      saveJigyosho(next);
      return next;
    });
  const removeJigyosho = (id: string) =>
    setState((s) => {
      const next = { ...s, jigyosho: s.jigyosho.filter((j) => j.id !== id) };
      saveJigyosho(next);
      return next;
    });
  const toggleJigyoshoOpen = (id: string) =>
    setState((s) => ({ ...s, jigyosho: s.jigyosho.map((j) => (j.id === id ? { ...j, _open: !j._open } : j)) }));

  if (!hydrated) return null;

  return (
    <div className="tanni-app min-h-dvh bg-zinc-50 pb-[calc(180px+env(safe-area-inset-bottom))] dark:bg-black">
      <datalist id="tanni-jihi-presets">
        {自費プリセット.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>

      <div className="tanni-app-chrome">
        <header className="sticky top-0 z-20 flex items-center gap-2.5 bg-teal-800 px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-2.5 text-white">
          <div className="flex-1">
            <h1 className="text-[17px] font-bold tracking-tight">単位数シミュレーター</h1>
            <span className="block text-[11px] opacity-85">訪問先で、その場で費用を出す</span>
          </div>
          <button
            type="button"
            onClick={openJigyoshoDialog}
            className="shrink-0 rounded-full bg-white/15 px-3.5 py-2 text-[13px] font-bold"
          >
            事業所設定
          </button>
        </header>

        <main className="mx-auto w-full max-w-[640px] px-3.5 pt-3.5">
          <h2 className="mt-1 mb-2 px-1 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">ご本人の条件</h2>
          <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3">
              <label className={labelCls}>要介護度</label>
              <div className="flex flex-wrap gap-1.5">
                {要介護度一覧.map((k) => (
                  <button key={k} type="button" onClick={() => setDegree(k)} className={pillCls(state.要介護度 === k)}>
                    {k.replace("要介護", "介").replace("要支援", "支")}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>負担割合</label>
                <div className="flex gap-1.5">
                  {([[0.1, "1割"], [0.2, "2割"], [0.3, "3割"]] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setBurden(v)} className={pillCls(state.負担割合 === v)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>地域区分</label>
                <select className={selectCls} value={state.地域区分} onChange={(e) => setArea(e.target.value)}>
                  {地域区分.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <label className={labelCls}>高額介護サービス費の区分</label>
            <select className={selectCls} value={state.高額区分} onChange={(e) => setKogaku(e.target.value)}>
              {高額介護サービス費.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}（上限 ¥{k.上限.toLocaleString()}）
                </option>
              ))}
            </select>
            <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              自己負担がこの上限を超えると、超えた分は後日払い戻されます。
            </div>
          </div>

          <h2 className="mt-4 mb-2 px-1 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">利用するサービス</h2>
          {state.rows.length === 0 ? (
            <div className="mb-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-[13px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              下のボタンからサービスを足してください
            </div>
          ) : (
            state.rows.map((row) => (
              <ServiceRow
                key={row.id}
                row={row}
                度={state.要介護度}
                jigyoshoList={state.jigyosho}
                onChange={(patch) => updateRow(row.id, patch)}
                onSelectJigyosho={(jid) => selectRowJigyosho(row.id, jid)}
                onRemove={() => removeRow(row.id)}
                onOpenJigyosho={() => setJigyoshoOpen(true)}
              />
            ))
          )}

          <QuickAdd 度={state.要介護度} onAdd={(key, 軸2) => addRow({ key, 軸2: 軸2 ?? undefined })} />

          <button
            type="button"
            onClick={() => addRow()}
            className="mb-4 w-full rounded-xl border-[1.5px] border-teal-700 bg-white py-3.5 text-[15px] font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
          >
            ＋ その他のサービスを追加
          </button>
        </main>

        <footer className="mx-auto w-full max-w-[640px] px-[18px] pt-1 pb-5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <div>
            {MASTER_VERSION.label}｜基本単位数：{MASTER_VERSION.基本単位数}／処遇改善加算：{MASTER_VERSION.処遇改善加算}
          </div>
          <div className="mt-1.5">
            この試算は概算です。各種加算・減算や事業所独自の設定により実際の金額とは差が出ます。ご契約前には必ず事業所の重要事項説明書・料金表をご確認ください。
          </div>
          <div className="mt-2.5">
            計算結果を利用者ごとに保存したり、プランA/Bを比較したいときは{" "}
            <Link href="/login" className="font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400">
              無料登録
            </Link>
            してください。
          </div>
        </footer>

        <SummarySheet
          r={result}
          rowsCount={state.rows.length}
          負担割合={state.負担割合}
          高額上限={高額上限}
          onOpenFamily={() => setFamOpen(true)}
          onOpenPrint={() => setPrintOpen(true)}
          onClearAll={clearAllRows}
        />
      </div>

      <FamilyDialog
        open={famOpen}
        onClose={() => setFamOpen(false)}
        onPrint={() => {
          setFamOpen(false);
          setPrintOpen(true);
        }}
        r={result}
        要介護度={state.要介護度}
        負担割合={state.負担割合}
      />
      <PrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        r={result}
        要介護度={state.要介護度}
        負担割合={state.負担割合}
        printName={state.印刷名}
        printBy={state.印刷作成者}
        onPrintNameChange={setPrintName}
        onPrintByChange={setPrintBy}
      />
      <JigyoshoDialog
        open={jigyoshoOpen}
        onClose={() => setJigyoshoOpen(false)}
        list={state.jigyosho}
        onAdd={addJigyosho}
        onUpdate={updateJigyosho}
        onRemove={removeJigyosho}
        onToggleOpen={toggleJigyoshoOpen}
      />
    </div>
  );
}
