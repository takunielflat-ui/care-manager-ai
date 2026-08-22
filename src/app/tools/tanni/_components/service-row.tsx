"use client";

import {
  サービス,
  検証ラベル,
  自費プリセットを取得,
  type 要介護度,
  type 負担限度額段階,
} from "@/lib/kaigo/master";
import { 単位数を取得, は月額包括, 週回数から月回数, type 自費項目 } from "@/lib/kaigo/calc";
import { axisInfo, keys2Of, 度が使えるか, type 事業所, type 行state } from "./state";

const badgeCls: Record<string, string> = {
  ok: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  muted: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const selectCls =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelCls = "mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400";

export default function ServiceRow({
  row,
  度,
  負担限度額段階,
  jigyoshoList,
  onChange,
  onSelectJigyosho,
  onRemove,
  onOpenJigyosho,
}: {
  row: 行state;
  度: 要介護度;
  負担限度額段階: 負担限度額段階 | null;
  jigyoshoList: 事業所[];
  onChange: (patch: Partial<行state>) => void;
  onSelectJigyosho: (jigyoshoId: string) => void;
  onRemove: () => void;
  onOpenJigyosho: (service: string) => void;
}) {
  const 自費プリセット = 自費プリセットを取得(負担限度額段階, row.service);
  const def = サービス[row.service];
  const ai = axisInfo(def);
  const 包括 = は月額包括(row, 度);
  const 使える = def.manualOnly || 度が使えるか(def, row.軸1, row.軸2, 度, row.service);
  const 予防 = 度.startsWith("要支援");
  const verifiedStatus = 予防 && def.verifiedYobo ? def.verifiedYobo : def.verified;
  const badge = 検証ラベル[verifiedStatus];

  const u = 単位数を取得(row, 度);
  const n = 包括 ? 1 : Number(row.月回数) || 0;
  const shoguRate =
    row.加算率上書き !== "" ? Number(row.加算率上書き) : row.処遇改善区分 && def.shogu ? def.shogu[row.処遇改善区分] || 0 : 0;
  const 処遇改善単位 = Math.round(u * n * (shoguRate / 100));

  const cands = jigyoshoList.filter((j) => j.service === row.service);
  const unitWord = def.freq === "per_day" ? "日" : "回";
  const shoguKeys = Object.keys(def.shogu || {});

  const changeService = (service: string) => {
    const d2 = サービス[service];
    const a2 = axisInfo(d2);
    const 軸1 = a2.hasL1 ? a2.keys1[0] : "_";
    const 軸2 = keys2Of(d2, 軸1, 度, service)[0] ?? null;
    onChange({
      service,
      軸1,
      軸2,
      処遇改善区分: (d2.shogu && Object.keys(d2.shogu)[0]) ?? null,
      jigyoshoId: null,
    });
  };

  const setJihi = (idx: number, patch: Partial<自費項目>) => {
    const 自費 = row.自費.map((j, i) => (i === idx ? { ...j, ...patch } : j));
    onChange({ 自費 });
  };
  const removeJihi = (idx: number) => onChange({ 自費: row.自費.filter((_, i) => i !== idx) });
  const addJihi = () => onChange({ 自費: [...row.自費, { name: "", unit: "回", amount: 0 }] });

  return (
    <div
      className={`mb-3 rounded-xl border bg-white p-3.5 shadow-sm dark:bg-zinc-950 ${
        使える ? "border-zinc-200 dark:border-zinc-800" : "border-amber-400 ring-2 ring-amber-400"
      }`}
    >
      {/* 見出し行 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{def.icon || "•"}</span>
        <select className={`${selectCls} flex-1 font-bold`} value={row.service} onChange={(e) => changeService(e.target.value)}>
          {Object.entries(サービス).map(([k, d]) => (
            <option key={k} value={k}>
              {d.label}
            </option>
          ))}
        </select>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${badgeCls[badge.cls]}`} title={badge.title}>
            {badge.text}
          </span>
        )}
        <button
          type="button"
          aria-label="削除"
          onClick={onRemove}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          ×
        </button>
      </div>

      {/* 事業所 */}
      <div className="mb-3">
        <div className={`${labelCls} flex items-center gap-2`}>
          事業所
          <button
            type="button"
            onClick={() => onOpenJigyosho(row.service)}
            className="ml-auto rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-400"
          >
            ＋登録・編集
          </button>
        </div>
        <select
          className={selectCls}
          value={row.jigyoshoId ?? ""}
          onChange={(e) => onSelectJigyosho(e.target.value)}
        >
          <option value="">{cands.length ? "― 選択しない（既定値）―" : "― 未登録 ―"}</option>
          {cands.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </div>

      {/* 区分セレクト */}
      {!def.manualOnly && (
        <div className={ai.hasL1 ? "mb-3 grid grid-cols-2 gap-2.5" : "mb-3"}>
          {ai.hasL1 && (
            <div>
              <label className={labelCls}>{ai.label1}</label>
              <select
                className={selectCls}
                value={row.軸1}
                onChange={(e) => {
                  const 軸1 = e.target.value;
                  onChange({ 軸1, 軸2: keys2Of(def, 軸1, 度, row.service)[0] ?? null });
                }}
              >
                {ai.keys1.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>{ai.label2}</label>
            <select className={selectCls} value={row.軸2 ?? ""} onChange={(e) => onChange({ 軸2: e.target.value })}>
              {keys2Of(def, row.軸1, 度, row.service).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 単位数（手入力） */}
      {def.manualOnly && (
        <div className="mb-3">
          <label className={labelCls}>単位数（1回あたり／月額）</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            value={row.manualUnits}
            placeholder="例）600"
            onChange={(e) => onChange({ manualUnits: e.target.value })}
          />
        </div>
      )}

      {/* 頻度 */}
      {!包括 ? (
        <div className="mb-3">
          <label className={labelCls}>利用回数</label>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              {(["週", "月"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange(m === "週" ? { mode: m, 月回数: 週回数から月回数(row.週回数) } : { mode: m })}
                  className={`px-3.5 py-2 text-sm font-bold ${
                    row.mode === m ? "bg-teal-700 text-white" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {row.mode === "週" ? (
              <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  type="button"
                  className="h-[42px] w-11 text-lg font-bold text-teal-700 dark:text-teal-400"
                  onClick={() => {
                    const 週回数 = Math.max(0, +(row.週回数 - 0.5).toFixed(1));
                    onChange({ 週回数, 月回数: 週回数から月回数(週回数) });
                  }}
                >
                  −
                </button>
                <span className="flex-1 text-center text-[15px] font-bold tabular-nums">
                  {row.週回数}
                  {unitWord}
                </span>
                <button
                  type="button"
                  className="h-[42px] w-11 text-lg font-bold text-teal-700 dark:text-teal-400"
                  onClick={() => {
                    const 週回数 = +(row.週回数 + 0.5).toFixed(1);
                    onChange({ 週回数, 月回数: 週回数から月回数(週回数) });
                  }}
                >
                  ＋
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  type="button"
                  className="h-[42px] w-11 text-lg font-bold text-teal-700 dark:text-teal-400"
                  onClick={() => onChange({ 月回数: Math.max(0, row.月回数 - 1) })}
                >
                  −
                </button>
                <span className="flex-1 text-center text-[15px] font-bold tabular-nums">
                  {row.月回数}
                  {unitWord}
                </span>
                <button
                  type="button"
                  className="h-[42px] w-11 text-lg font-bold text-teal-700 dark:text-teal-400"
                  onClick={() => onChange({ 月回数: row.月回数 + 1 })}
                >
                  ＋
                </button>
              </div>
            )}
          </div>
          {row.mode === "週" && (
            <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              → 月あたり{" "}
              <input
                type="number"
                inputMode="numeric"
                className="inline-block w-16 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={row.月回数}
                onChange={(e) => onChange({ 月回数: Math.max(0, Number(e.target.value) || 0) })}
              />
              {unitWord}（1か月≒4.35週。実日数に合わせて直接編集できます）
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">月額包括のため回数入力は不要です</div>
      )}

      {/* 処遇改善加算 */}
      {shoguKeys.length > 0 && (
        <div className="mb-3">
          <label className={labelCls}>処遇改善加算</label>
          <select className={selectCls} value={row.処遇改善区分 ?? ""} onChange={(e) => onChange({ 処遇改善区分: e.target.value || null })}>
            <option value="">算定なし</option>
            {shoguKeys.map((k) => (
              <option key={k} value={k}>
                {k}（{def.shogu[k]}％）
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 自費項目 */}
      <div className="mb-3">
        <div className={`${labelCls} flex items-center gap-2`}>
          自費分
          <button
            type="button"
            onClick={addJihi}
            className="ml-auto rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-400"
          >
            ＋追加
          </button>
        </div>
        {row.自費.map((j, idx) => (
          <div key={idx} className="mb-1.5 grid grid-cols-[1fr_84px_74px_34px] gap-1.5">
            <input
              className={`${inputCls} px-2 py-2 text-sm`}
              value={j.name}
              placeholder="項目名"
              list="tanni-jihi-presets"
              onChange={(e) => {
                const name = e.target.value;
                const preset = 自費プリセット.find((p) => p.name === name);
                if (preset && !j.touched) setJihi(idx, { name, unit: preset.unit, amount: preset.amount });
                else setJihi(idx, { name });
              }}
            />
            <input
              type="number"
              inputMode="numeric"
              className={`${inputCls} px-2 py-2 text-right text-sm`}
              value={j.amount}
              onChange={(e) => setJihi(idx, { touched: 1, amount: Number(e.target.value) || 0 })}
            />
            <select
              className={`${selectCls} px-2 py-2 text-sm`}
              value={j.unit}
              onChange={(e) => setJihi(idx, { touched: 1, unit: e.target.value as 自費項目["unit"] })}
            >
              {(["回", "日", "月"] as const).map((u2) => (
                <option key={u2} value={u2}>
                  円/{u2}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeJihi(idx)}
              className="flex h-[38px] w-[34px] items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 小計 */}
      <div className="mt-2.5 border-t border-dashed border-zinc-200 pt-2.5 text-sm font-bold text-teal-700 tabular-nums dark:border-zinc-700 dark:text-teal-400">
        {包括 ? `${u.toLocaleString()}単位（月額包括）` : `${u.toLocaleString()}単位 × ${n}回 = ${(u * n).toLocaleString()}単位`}
        {処遇改善単位 > 0 && (
          <span className="ml-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            ＋処遇改善 {処遇改善単位.toLocaleString()}単位
          </span>
        )}
      </div>

      {!使える && (
        <div className="mt-2.5 rounded-lg bg-amber-100 px-2.5 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-400">
          ※ {度} ではこの区分は算定できません
        </div>
      )}
      {def.note && (
        <div className="mt-2.5 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          {def.note}
        </div>
      )}
      {badge?.cls === "warn" && (
        <div className="mt-2.5 rounded-lg bg-amber-100 px-2.5 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-400">
          ※ この単位数は一次資料での突合が未了です（{予防 ? "介護予防分" : badge.text}）。事業所の料金表と照合してください。
        </div>
      )}
    </div>
  );
}
