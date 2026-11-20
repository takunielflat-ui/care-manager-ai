"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  MASTER_VERSION,
  自費プリセット,
  地域区分,
  要介護度一覧,
  高額介護サービス費,
  負担限度額,
  type 要介護度,
  type 負担限度額段階,
} from "@/lib/kaigo/master";
import ServiceRow from "./service-row";
import QuickAdd from "./quick-add";
import SummarySheet from "./summary-sheet";
import FamilyDialog from "./family-dialog";
import PrintDialog from "./print-dialog";
import JigyoshoDialog from "./jigyosho-dialog";
import TopLink, { SavedPlansLink } from "./top-link";
import SavePlanDialog, { type TanniPlanState, type 開いている計算 } from "./save-plan-dialog";
import { プランを計算 } from "./plan-calc";
import {
  applyJigyosho,
  loadCond,
  loadJigyosho,
  newRow,
  saveCond,
  saveJigyosho,
  uid,
  最後の計算IDを残す,
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
  return { ...cond, 印刷名: "", 超過割当: null, rows, jigyosho, seq: seq + 1 };
}

const noopSubscribe = () => () => {};

/** サーバーに保存する中身。上書き保存と「変更があるか」の判定の両方で同じものを使う */
function 保存する中身(s: TanniPlanState): TanniPlanState {
  return {
    要介護度: s.要介護度,
    地域区分: s.地域区分,
    負担割合: s.負担割合,
    高額区分: s.高額区分,
    負担限度額段階: s.負担限度額段階,
    印刷作成者: s.印刷作成者,
    超過割当: s.超過割当 ?? null,
    rows: s.rows,
  };
}
const 比べる形 = (p: TanniPlanState) => JSON.stringify(保存する中身(p));

const 日時 = (iso: string) => new Date(iso).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });

export default function TanniSimulator() {
  const [state, setState] = useState<AppState>(初期状態を作る);
  // サーバーでは false、クライアントの初回コミット以降は true。
  // setState を使わずに済む useSyncExternalStore の定番パターンで、
  // ハイドレーション不一致を起こさずに「マウント済みか」を判定する。
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [famOpen, setFamOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [jigyoshoOpen, setJigyoshoOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const 高額上限 = useMemo(
    () => 高額介護サービス費.find((k) => k.id === state.高額区分)?.上限 ?? null,
    [state.高額区分],
  );

  // 計算そのものは plan-calc.ts の共有ヘルパに委譲する。
  // 保存一覧（tanni-plans-view）と同じ関数を使うことで、
  // 電卓の数字と一覧・比較の数字が必ず一致する。
  const result = useMemo(() => プランを計算(state), [state]);

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
  const set負担限度額段階 = (v: 負担限度額段階 | null) =>
    setState((s) => {
      const next = { ...s, 負担限度額段階: v };
      saveCond(next);
      return next;
    });
  const set超過割当 = (id: number | null) => setState((s) => ({ ...s, 超過割当: id }));
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
  // 「全部消す」は新しく作り直す操作なので、開いている計算からも離れる（上書きの事故を防ぐ）
  const clearAllRows = () => {
    setState((s) => ({ ...s, rows: [] }));
    setOpenPlan(null);
  };

  // いま開いている保存済みの計算と、そのとき保存されていた中身（変更があるかの判定用）
  const [openPlan, setOpenPlan] = useState<(開いている計算 & { 保存時: string }) | null>(null);
  const 今の中身 = 保存する中身(state);
  const 未保存の変更あり = openPlan != null && 比べる形(今の中身) !== openPlan.保存時;

  const 開いた計算を覚える = (meta: 開いている計算, 中身: TanniPlanState) => {
    setOpenPlan({ id: meta.id, title: meta.title, updated_at: meta.updated_at, 保存時: 比べる形(中身) });
    最後の計算IDを残す(meta.id);
  };

  const loadPlan = (plan: TanniPlanState, meta: 開いている計算) => {
    // 読み込んだ直後の画面と同じ形で覚えておく（古い区分名の読み替え後）
    開いた計算を覚える(meta, { ...plan, 超過割当: plan.超過割当 ?? null, rows: 要介護度に合わせて行を直す(plan.rows, plan.要介護度) });
    setState((s) => {
      const next = {
        ...s,
        要介護度: plan.要介護度,
        地域区分: plan.地域区分,
        負担割合: plan.負担割合,
        高額区分: plan.高額区分,
        負担限度額段階: plan.負担限度額段階,
        印刷作成者: plan.印刷作成者,
        // 実名はサーバーに置かないので、読み込み時は空にする（別の方の名前が残るのも防ぐ）
        印刷名: "",
        超過割当: plan.超過割当 ?? null,
        // 古い区分名で保存された行も、いまの区分に読み替える（自費はそのまま残る）
        rows: 要介護度に合わせて行を直す(plan.rows, plan.要介護度),
        seq: Math.max(s.seq, ...plan.rows.map((r) => r.id + 1)),
      };
      saveCond(next);
      return next;
    });
  };

  // 「保存した計算」一覧から ?plan=<id> 付きで開かれたら、その保存を読み込む。
  // 読み込んだらURLからパラメータを外し、再読み込みで二重取得しないようにする。
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("plan");
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tanni-plans/${id}`);
        const data: { plan?: 開いている計算 & { state: TanniPlanState } } = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.plan?.state) {
          const { state: 中身, ...meta } = data.plan;
          loadPlan(中身, meta);
        }
      } catch {
        // 読み込めなくても電卓は通常どおり使えるので、何もしない
      } finally {
        if (!cancelled) window.history.replaceState(null, "", "/tools/tanni");
      }
    })();
    return () => {
      cancelled = true;
    };
    // マウント時に1回だけ実行する（loadPlan は毎回作り直されるので依存に入れない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <TopLink className="shrink-0 flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[13px] font-bold" />
          <div className="flex-1">
            <h1 className="text-[17px] font-bold tracking-tight">単位数シミュレーター</h1>
            <span className="block text-[11px] opacity-85">訪問先で、その場で費用を出す</span>
          </div>
          <Link
            href="/tools/tanni/help"
            className="shrink-0 rounded-full bg-white/15 px-3.5 py-2 text-[13px] font-bold"
          >
            使い方
          </Link>
          <button
            type="button"
            onClick={openJigyoshoDialog}
            className="shrink-0 rounded-full bg-white/15 px-3.5 py-2 text-[13px] font-bold"
          >
            事業所設定
          </button>
        </header>

        <main className="mx-auto w-full max-w-[640px] px-3.5 pt-3.5">
          <SavedPlansLink
            confirmMessage={未保存の変更あり ? "まだ保存していない変更があります。このまま一覧に移ると、変更は消えます。移りますか？" : null}
            className="mb-3 flex w-full items-center justify-center rounded-xl border-[1.5px] border-teal-700 bg-white py-3 text-[14px] font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
          />
          {openPlan && (
            <div
              className={`mb-3 rounded-xl border-[1.5px] p-3 ${
                未保存の変更あり
                  ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950"
                  : "border-teal-700 bg-teal-50 dark:bg-teal-950"
              }`}
            >
              <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">📂 開いている計算</div>
              <div className="truncate text-[15px] font-bold text-zinc-900 dark:text-zinc-50">{openPlan.title}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{日時(openPlan.updated_at)} 保存</div>
              <div
                className={`mt-1.5 text-[13px] font-bold ${
                  未保存の変更あり ? "text-amber-800 dark:text-amber-300" : "text-teal-700 dark:text-teal-400"
                }`}
              >
                {未保存の変更あり
                  ? "⚠ まだ保存していない変更があります（画面下の「💾 この計算を保存する」から上書きできます）"
                  : "✓ 保存した内容のままです"}
              </div>
            </div>
          )}
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

          <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <label className={labelCls}>負担限度額認定（ショートステイの食費・居住費）</label>
            <select
              className={selectCls}
              value={state.負担限度額段階 ?? ""}
              onChange={(e) => set負担限度額段階((e.target.value || null) as 負担限度額段階 | null)}
            >
              <option value="">認定なし（基準費用額のまま）</option>
              {負担限度額.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              認定証をお持ちの方はここで段階を選ぶと、短期入所の行で「食費」「滞在費」を入力したときの金額候補が軽減後の金額になります。高額介護サービス費（自己負担額の上限）とは別の制度です。
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
                負担限度額段階={state.負担限度額段階}
                jigyoshoList={state.jigyosho}
                onChange={(patch) => updateRow(row.id, patch)}
                onSelectJigyosho={(jid) => selectRowJigyosho(row.id, jid)}
                onRemove={() => removeRow(row.id)}
                onOpenJigyosho={() => setJigyoshoOpen(true)}
              />
            ))
          )}

          {result.超過単位 > 0 && (
            <div className="mb-3 rounded-xl border-[1.5px] border-red-300 bg-red-50 p-3.5 dark:border-red-900 dark:bg-red-950">
              <label className={labelCls}>
                上限を超えた分（{result.超過単位.toLocaleString()}単位）をどのサービスから出すか
              </label>
              <select
                className={selectCls}
                value={state.超過割当 ?? ""}
                onChange={(e) => set超過割当(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">自動（一番下のサービスから）</option>
                {result.details
                  .filter((d) => d.限度額対象 && d.小計単位 > 0)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label.replace(/（.*/, "")}
                      {d.軸2 ? "（" + d.軸2 + "）" : ""}
                    </option>
                  ))}
              </select>
              <div className="mt-1.5 text-xs text-red-800 dark:text-red-300">
                いま：{result.超過割当先.map((x) => x.label + " " + x.単位.toLocaleString() + "単位").join("、")}
                。超えた単位とその処遇改善加算は全額（10割）のご負担として計算し、PDFにも明記します。
              </div>
            </div>
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
            計算は「💾 この計算を保存する」で利用者ごとに保存できます。保存した計算の見直し・プランA/Bの比較は{" "}
            <Link
              href="/tools/tanni/plans"
              className="font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              保存した計算の一覧
            </Link>
            から（保存・閲覧には無料登録が必要です）。
          </div>
        </footer>

        <SummarySheet
          r={result}
          rowsCount={state.rows.length}
          負担割合={state.負担割合}
          高額上限={高額上限}
          onOpenFamily={() => setFamOpen(true)}
          onOpenPrint={() => setPrintOpen(true)}
          onOpenSave={() => setSaveOpen(true)}
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
        地域区分ラベル={地域区分.find((a) => a.id === state.地域区分)?.label ?? state.地域区分}
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
      <SavePlanDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        currentState={今の中身}
        openPlan={openPlan}
        onLoad={loadPlan}
        onSaved={開いた計算を覚える}
        onDeleted={(id) => setOpenPlan((p) => (p?.id === id ? null : p))}
      />
    </div>
  );
}
