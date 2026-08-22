"use client";

import { useEffect, useRef } from "react";
import { 円, type 計算結果 } from "@/lib/kaigo/calc";
import type { 要介護度 } from "@/lib/kaigo/master";
import { GaugeBar } from "./gauge";

function FamKv({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 py-2.5 text-[15px] first:border-0 dark:border-zinc-800">
      <span>{k}</span>
      <b className={`text-[17px] tabular-nums ${cls ?? ""}`}>{v}</b>
    </div>
  );
}

export default function FamilyDialog({
  open,
  onClose,
  onPrint,
  r,
  要介護度,
  負担割合,
}: {
  open: boolean;
  onClose: () => void;
  onPrint: () => void;
  r: 計算結果 | null;
  要介護度: 要介護度;
  負担割合: number;
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
      className="mx-auto mt-auto mb-0 max-h-[92vh] w-full max-w-[560px] rounded-t-2xl border-0 bg-zinc-50 p-0 text-zinc-900 backdrop:bg-black/45 dark:bg-black dark:text-zinc-50"
    >
      <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-teal-900 px-4 py-3.5 text-white">
        <b className="flex-1 text-[15px]">ご利用料金のめやす</b>
        <button type="button" onClick={onPrint} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          🖨 印刷
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          閉じる
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-3.5">
        {!r || r.details.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">サービスがありません</div>
        ) : (
          <>
            <div className="mb-3.5 mt-1.5 text-center text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
              {要介護度}・自己負担{Math.round(負担割合 * 10)}割 の場合
            </div>

            <div className="mb-3.5 rounded-2xl bg-white p-[22px] text-center shadow-sm dark:bg-zinc-950">
              <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400">今月の自己負担の目安</div>
              <div className="my-1.5 text-[46px] leading-[1.15] font-extrabold tracking-tight text-teal-700 tabular-nums dark:text-teal-400">
                {円(r.月額合計)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">おおよその金額です</div>
            </div>

            <div className="mb-3.5 rounded-2xl bg-white p-[15px] shadow-sm dark:bg-zinc-950">
              <div className="mb-2.5 flex items-baseline justify-between text-[13px] font-bold">
                <span>介護保険で使える上限</span>
                <b className={r.帯 === "over" ? "text-[20px] text-red-600 dark:text-red-400" : "text-[20px] tabular-nums"}>
                  {(r.使用率 * 100).toFixed(0)}％
                </b>
              </div>
              <GaugeBar r={r} big />
              <div className="mt-2.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {r.給付管理単位.toLocaleString()} / {r.限度額.toLocaleString()} 単位
                {r.超過単位 ? `（${r.超過単位.toLocaleString()}単位オーバー）` : `（残り ${r.残単位.toLocaleString()}単位）`}
              </div>
            </div>

            {r.超過自己負担 > 0 && (
              <div className="mb-3.5 rounded-2xl bg-red-100 p-[15px] text-sm leading-relaxed text-red-800 dark:bg-red-950 dark:text-red-300">
                <div className="mb-1 text-[15px] font-extrabold">※ 上限を超えています</div>
                <div>{円(r.超過自己負担)} 分は介護保険が使えず、全額自己負担になります。</div>
              </div>
            )}

            <div className="mb-3.5 rounded-2xl bg-white p-[15px] shadow-sm dark:bg-zinc-950">
              <div className="mb-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">ご利用の内容</div>
              {r.details.map((x) => (
                <div key={x.id} className="flex items-center gap-2.5 border-t border-zinc-100 py-2.5 text-[15px] first:border-0 dark:border-zinc-800">
                  <span className="text-[19px]">{x.icon}</span>
                  <span className="flex-1 font-bold">
                    {x.label.replace(/（.*/, "")}
                    <small className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {x.包括 ? "月ぎめ" : `月 ${x.回数} 回`}
                    </small>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{x.自費 ? 円(x.自費) : ""}</span>
                </div>
              ))}
            </div>

            <div className="mb-3.5 rounded-2xl bg-white p-[15px] shadow-sm dark:bg-zinc-950">
              <div className="mb-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">内訳</div>
              <FamKv k="介護保険の自己負担" v={円(r.介護保険分自己負担)} />
              {r.超過自己負担 ? <FamKv k="上限を超えた分" v={円(r.超過自己負担)} cls="text-red-600 dark:text-red-400" /> : null}
              {r.自費合計 ? <FamKv k="食費・日用品など" v={円(r.自費合計)} /> : null}
              <div className="mt-1 flex items-center justify-between border-t-2 border-zinc-900 pt-[13px] font-extrabold dark:border-zinc-100">
                <span>合計</span>
                <b className="text-2xl text-teal-700 dark:text-teal-400">{円(r.月額合計)}</b>
              </div>
              {r.高額該当 && (
                <div className="mt-3 rounded-lg bg-teal-50 p-[11px_13px] text-[13px] font-semibold leading-relaxed text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                  高額介護サービス費の対象です。{円(r.高額払戻)} ほどが後から戻るため、実際のご負担は {円(r.月額合計_高額後)} くらいになる見込みです。
                </div>
              )}
            </div>

            <div className="px-1.5 pb-4 text-center text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              加算などにより実際の金額は前後します。正確な金額は各事業所の料金表でご確認ください。
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
