"use client";

import { useState } from "react";
import { 円, type 計算結果 } from "@/lib/kaigo/calc";
import { GaugeBar } from "./gauge";

function Kv({ k, v, strong, cls }: { k: string; v: string; strong?: boolean; cls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800">
      <span className="text-zinc-600 dark:text-zinc-400">{k}</span>
      {strong ? (
        <b className={`tabular-nums ${cls ?? ""}`}>{v}</b>
      ) : (
        <span className={`tabular-nums ${cls ?? ""}`}>{v}</span>
      )}
    </div>
  );
}

export default function SummarySheet({
  r,
  rowsCount,
  負担割合,
  高額上限,
  onOpenFamily,
  onOpenPrint,
  onClearAll,
}: {
  r: 計算結果;
  rowsCount: number;
  負担割合: number;
  高額上限: number | null;
  onOpenFamily: () => void;
  onOpenPrint: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, r.使用率 * 100);

  const copySummary = () => {
    const L: string[] = [];
    L.push(`【介護サービス費用の概算】${r.要介護度}／負担${Math.round(負担割合 * 10)}割`);
    L.push("");
    for (const x of r.details) {
      L.push(`・${x.label}${x.軸2 ? "（" + x.軸2 + "）" : ""}${x.包括 ? "" : " 月" + x.回数 + "回"}`);
    }
    L.push("");
    L.push(`合計単位数：${r.給付管理単位.toLocaleString()}単位（限度額 ${r.限度額.toLocaleString()}単位）`);
    if (r.超過単位) L.push(`※${r.超過単位.toLocaleString()}単位超過。超過分 ${円(r.超過自己負担)} は全額自己負担です。`);
    else L.push(`残り ${r.残単位.toLocaleString()}単位`);
    L.push(`自己負担（保険内）：${円(r.介護保険分自己負担)}`);
    if (r.自費合計) L.push(`自費分（食費など）：${円(r.自費合計)}`);
    L.push(`──────────`);
    L.push(`月額のお支払い目安：${円(r.月額合計)}`);
    L.push("");
    L.push("※加算等により実際の金額は前後します。正確な金額は各事業所の料金表をご確認ください。");
    const txt = L.join("\n");
    navigator.clipboard?.writeText(txt).catch(() => {});
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(16,40,50,0.14)] dark:bg-zinc-950"
      data-band={r.帯}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex-none px-[18px] pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] text-left"
      >
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex items-baseline gap-2.5">
          <span className="shrink-0 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            今月の自己負担目安
            <br />
            <span className="text-[11px] font-normal">タップで内訳 {open ? "▼" : "▲"}</span>
          </span>
          <span className={`ml-auto text-[27px] font-extrabold tracking-tight tabular-nums ${r.帯 === "over" ? "text-red-600 dark:text-red-400" : "text-teal-700 dark:text-teal-400"}`}>
            {円(r.月額合計)}
          </span>
        </div>
        {rowsCount > 0 ? (
          <div className="mt-1 text-right text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
            保険内 <b className="text-zinc-900 dark:text-zinc-50">{円(r.介護保険分自己負担)}</b>
            {r.超過自己負担 ? (
              <>
                {" "}
                ／ 超過 <b className="text-red-600 dark:text-red-400">{円(r.超過自己負担)}</b>
              </>
            ) : null}
            {r.自費合計 ? (
              <>
                {" "}
                ／ 自費 <b className="text-zinc-900 dark:text-zinc-50">{円(r.自費合計)}</b>
              </>
            ) : null}
          </div>
        ) : (
          <div className="mt-1 text-right text-[11.5px] text-zinc-500 dark:text-zinc-400">サービスを追加してください</div>
        )}
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="flex-1">
            <GaugeBar r={r} />
          </div>
          {rowsCount > 0 && (
            <div className="text-[11px] whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400">
              <b className="text-zinc-900 dark:text-zinc-50">{r.給付管理単位.toLocaleString()}</b> / {r.限度額.toLocaleString()} 単位
              <span
                className={`ml-1.5 font-extrabold ${
                  r.帯 === "over" ? "text-red-600 dark:text-red-400" : r.帯 === "caution" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pct.toFixed(0)}％
              </span>
            </div>
          )}
        </div>
        {r.超過自己負担 > 0 ? (
          <div className="mt-2.5 rounded-lg bg-red-100 px-3 py-2.5 text-[13px] leading-relaxed font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
            ⚠️ 上限を <b>{r.超過単位.toLocaleString()}単位</b> 超えています。
            <br />
            <b>{円(r.超過自己負担)}</b> 分は<b>全額自己負担</b>になります。
          </div>
        ) : r.帯 === "caution" && rowsCount > 0 ? (
          <div className="mt-2.5 rounded-lg bg-amber-100 px-3 py-2.5 text-[13px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            上限まであと <b>{r.残単位.toLocaleString()}単位</b>。追加するときは注意してください。
          </div>
        ) : null}
      </button>

      {open && (
        <div className="overflow-y-auto px-3.5 pb-3.5">
          {rowsCount === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">サービスを追加すると集計が出ます</div>
          ) : (
            <>
              <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-1.5 flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  <span>区分支給限度基準額（使える上限）</span>
                  <b className={`tabular-nums ${r.超過単位 > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"}`}>
                    {r.給付管理単位.toLocaleString()} / {r.限度額.toLocaleString()} 単位
                  </b>
                </div>
                <GaugeBar r={r} big />
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11.5px]">
                  {r.超過単位 > 0 ? (
                    <span className="text-red-600 dark:text-red-400">
                      {r.超過単位.toLocaleString()}単位オーバー（全額自己負担 {円(r.超過自己負担)}）
                    </span>
                  ) : (
                    <span>残り {r.残単位.toLocaleString()}単位（{(100 - pct).toFixed(0)}％）</span>
                  )}
                </div>
              </div>

              <div className="mb-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      <th className="pb-1.5">サービス</th>
                      <th className="pb-1.5 text-right">単位</th>
                      <th className="pb-1.5 text-right">自費</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.details.map((x) => (
                      <tr key={x.id} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                        <td className="py-2">
                          <div className="font-bold leading-snug">
                            {x.icon} {x.label}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {[x.軸1 !== "_" ? x.軸1 : null, x.軸2].filter(Boolean).join(" / ")}
                            {x.包括 ? "（月額包括）" : ` × ${x.回数}回`}
                          </div>
                        </td>
                        <td className="py-2 pl-2 text-right font-bold tabular-nums whitespace-nowrap">
                          {(x.小計単位 + x.処遇改善単位).toLocaleString()}
                          {x.処遇改善単位 ? (
                            <div className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">内 加算{x.処遇改善単位.toLocaleString()}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{x.自費 ? 円(x.自費) : "―"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
                <Kv k="介護サービス費用（10割）" v={円(r.費用総額)} />
                <Kv k="介護保険からの給付" v={"− " + 円(r.費用総額 - r.介護保険分自己負担 - r.超過自己負担)} />
                <Kv k={`自己負担（${Math.round(負担割合 * 10)}割）`} v={円(r.介護保険分自己負担)} strong />
                {r.超過自己負担 ? <Kv k="限度額超過分（全額自己負担）" v={円(r.超過自己負担)} strong cls="text-red-600 dark:text-red-400" /> : null}
                {r.自費合計 ? <Kv k="自費分（食費など）" v={円(r.自費合計)} /> : null}
                <div className="mt-1.5 flex items-center justify-between border-t-2 border-zinc-900 pt-3 text-base font-bold dark:border-zinc-100">
                  <span>月額合計（概算）</span>
                  <b className="text-[22px] text-teal-700 dark:text-teal-400">{円(r.月額合計)}</b>
                </div>
                {r.高額該当 && 高額上限 != null && (
                  <div className="mt-2.5 rounded-lg bg-teal-50 px-2.5 py-2 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                    高額介護サービス費の上限（{円(高額上限)}）を超えています。約 {円(r.高額払戻)} が後日払い戻される見込みで、実質負担は約{" "}
                    {円(r.月額合計_高額後)} です。
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <button type="button" onClick={onOpenFamily} className="w-full rounded-xl bg-teal-700 py-3.5 text-[15px] font-bold text-white">
                  👨‍👩‍👧 家族に見せる画面
                </button>
                <button
                  type="button"
                  onClick={onOpenPrint}
                  className="w-full rounded-xl border-[1.5px] border-teal-700 bg-white py-3.5 text-[15px] font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
                >
                  🖨 家族にわたす紙を作る
                </button>
                <button
                  type="button"
                  onClick={copySummary}
                  className="w-full rounded-xl border-[1.5px] border-teal-700 bg-white py-3.5 text-[15px] font-bold text-teal-700 dark:bg-zinc-950 dark:text-teal-400"
                >
                  📋 説明用の文章をコピー
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("入力中のサービスをすべて消します。よろしいですか？")) onClearAll();
                  }}
                  className="w-full rounded-xl border-[1.5px] border-red-600 bg-transparent py-2.5 text-[13px] font-bold text-red-600 dark:text-red-400"
                >
                  🗑 全部消す
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
