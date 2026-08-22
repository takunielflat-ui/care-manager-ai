"use client";

import { useEffect, useRef } from "react";
import { サービス, 自費プリセット } from "@/lib/kaigo/master";
import type { 自費項目 } from "@/lib/kaigo/calc";
import { axisInfo, keys2Of, type 事業所 } from "./state";

const selectCls =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const inputCls = selectCls;
const labelCls = "mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400";

export default function JigyoshoDialog({
  open,
  onClose,
  list,
  onAdd,
  onUpdate,
  onRemove,
  onToggleOpen,
}: {
  open: boolean;
  onClose: () => void;
  list: 事業所[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<事業所>) => void;
  onRemove: (id: string) => void;
  onToggleOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const setJihi = (j: 事業所, idx: number, patch: Partial<自費項目>) => {
    const 自費 = (j.自費 || []).map((x, i) => (i === idx ? { ...x, ...patch } : x));
    onUpdate(j.id, { 自費 });
  };
  const addJihi = (j: 事業所) => onUpdate(j.id, { 自費: [...(j.自費 || []), { name: "", unit: "回", amount: 0 }] });
  const removeJihi = (j: 事業所, idx: number) => onUpdate(j.id, { 自費: (j.自費 || []).filter((_, i) => i !== idx) });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="tanni-dialog-chrome mx-auto mt-auto mb-0 max-h-[92vh] w-full max-w-[640px] rounded-t-2xl border-0 bg-zinc-50 p-0 text-zinc-900 backdrop:bg-black/45 dark:bg-black dark:text-zinc-50"
    >
      <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-teal-900 px-4 py-3.5 text-white">
        <b className="flex-1 text-[15px]">事業所の設定</b>
        <button type="button" onClick={onAdd} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          ＋ 追加
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          閉じる
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-3.5">
        <div className="mb-3 rounded-lg bg-zinc-100 px-2.5 py-2 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          よく使う事業所を登録しておくと、訪問先ではサービスを選ぶだけで規模・時間区分・処遇改善加算・食費などが自動で入ります。
          <br />
          登録内容はこの端末のブラウザにだけ保存されます。
        </div>

        {list.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            まだ登録がありません。よく使う事業所を登録しておくと、訪問先で選ぶだけになります。
          </div>
        )}

        {list.map((j) => {
          const def = サービス[j.service];
          const ai = axisInfo(def);
          const isOpen = !!j._open;
          return (
            <div key={j.id} className="mb-3 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <button type="button" onClick={() => onToggleOpen(j.id)} className="flex w-full items-center gap-2.5 px-3.5 py-3.5 text-left">
                <div className="flex-1">
                  <b>{j.name || "（無名）"}</b>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {def?.icon} {def?.label || j.service}
                    {j.軸2 ? " / " + j.軸2 : ""}
                    {j.処遇改善区分 ? " / 処遇改善" + j.処遇改善区分 : ""}
                    {j.自費?.length ? ` / 自費${j.自費.length}件` : ""}
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3.5">
                  <div className="mb-3">
                    <label className={labelCls}>事業所名</label>
                    <input
                      className={inputCls}
                      value={j.name}
                      placeholder="例）デイケアさくら"
                      onChange={(e) => onUpdate(j.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className={labelCls}>サービス種別</label>
                    <select
                      className={selectCls}
                      value={j.service}
                      onChange={(e) => {
                        const service = e.target.value;
                        const d2 = サービス[service];
                        const a2 = axisInfo(d2);
                        const 軸1 = a2.hasL1 ? a2.keys1[0] : "_";
                        onUpdate(j.id, {
                          service,
                          軸1,
                          軸2: keys2Of(d2, 軸1, null, service)[0] ?? null,
                          処遇改善区分: (d2.shogu && Object.keys(d2.shogu)[0]) ?? null,
                        });
                      }}
                    >
                      {Object.entries(サービス).map(([k, d]) => (
                        <option key={k} value={k}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!def.manualOnly ? (
                    <div className={ai.hasL1 ? "mb-3 grid grid-cols-2 gap-2.5" : "mb-3"}>
                      {ai.hasL1 && (
                        <div>
                          <label className={labelCls}>{ai.label1}</label>
                          <select
                            className={selectCls}
                            value={j.軸1 ?? "_"}
                            onChange={(e) => {
                              const 軸1 = e.target.value;
                              onUpdate(j.id, { 軸1, 軸2: keys2Of(def, 軸1, null, j.service)[0] ?? null });
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
                        <label className={labelCls}>{ai.label2}（既定）</label>
                        <select className={selectCls} value={j.軸2 ?? ""} onChange={(e) => onUpdate(j.id, { 軸2: e.target.value })}>
                          {keys2Of(def, j.軸1 ?? "_", null, j.service).map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <label className={labelCls}>単位数（既定）</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={j.manualUnits || ""}
                        onChange={(e) => onUpdate(j.id, { manualUnits: e.target.value })}
                      />
                    </div>
                  )}

                  {Object.keys(def.shogu || {}).length > 0 && (
                    <div className="mb-3">
                      <label className={labelCls}>処遇改善加算</label>
                      <select
                        className={selectCls}
                        value={j.処遇改善区分 ?? ""}
                        onChange={(e) => onUpdate(j.id, { 処遇改善区分: e.target.value || null })}
                      >
                        <option value="">算定なし</option>
                        {Object.keys(def.shogu).map((k) => (
                          <option key={k} value={k}>
                            {k}（{def.shogu[k]}％）
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <div className={`${labelCls} flex items-center gap-2`}>
                      自費項目
                      <button
                        type="button"
                        onClick={() => addJihi(j)}
                        className="ml-auto rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-400"
                      >
                        ＋追加
                      </button>
                    </div>
                    {(j.自費 || []).map((x, idx) => (
                      <div key={idx} className="mb-1.5 grid grid-cols-[1fr_84px_74px_34px] gap-1.5">
                        <input
                          className={`${inputCls} px-2 py-2 text-sm`}
                          value={x.name}
                          list="tanni-jihi-presets"
                          placeholder="項目名"
                          onChange={(e) => {
                            const name = e.target.value;
                            const preset = 自費プリセット.find((p) => p.name === name);
                            if (preset && !x.touched) setJihi(j, idx, { name, unit: preset.unit, amount: preset.amount });
                            else setJihi(j, idx, { name });
                          }}
                        />
                        <input
                          type="number"
                          className={`${inputCls} px-2 py-2 text-right text-sm`}
                          value={x.amount}
                          onChange={(e) => setJihi(j, idx, { touched: 1, amount: Number(e.target.value) || 0 })}
                        />
                        <select
                          className={`${selectCls} px-2 py-2 text-sm`}
                          value={x.unit}
                          onChange={(e) => setJihi(j, idx, { touched: 1, unit: e.target.value as 自費項目["unit"] })}
                        >
                          {(["回", "日", "月"] as const).map((u) => (
                            <option key={u} value={u}>
                              円/{u}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeJihi(j, idx)}
                          className="flex h-[38px] w-[34px] items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`「${j.name}」を削除しますか？`)) onRemove(j.id);
                    }}
                    className="mb-3.5 w-full rounded-xl border-[1.5px] border-red-600 py-2.5 text-[13px] font-bold text-red-600 dark:text-red-400"
                  >
                    この事業所を削除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </dialog>
  );
}

