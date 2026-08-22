"use client";

import { useEffect, useRef } from "react";
import { 円, 計算ステップ, type 計算結果 } from "@/lib/kaigo/calc";
import { サービス, type 要介護度 } from "@/lib/kaigo/master";

function PrKv({ k, v, over }: { k: string; v: string; over?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-300 py-1.5 text-[10.5pt]">
      <span>{k}</span>
      <b className={over ? "text-red-700" : ""}>{v}</b>
    </div>
  );
}

export default function PrintDialog({
  open,
  onClose,
  r,
  要介護度,
  負担割合,
  printName,
  printBy,
  onPrintNameChange,
  onPrintByChange,
}: {
  open: boolean;
  onClose: () => void;
  r: 計算結果 | null;
  要介護度: 要介護度;
  負担割合: number;
  printName: string;
  printBy: string;
  onPrintNameChange: (v: string) => void;
  onPrintByChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const now = new Date();
  const 割 = Math.round(負担割合 * 10);
  const steps = r ? 計算ステップ(r, 負担割合).steps : [];
  const pct = r ? Math.min(100, r.使用率 * 100) : 0;
  const 帯色 = r?.帯 === "over" ? "bg-red-600" : r?.帯 === "caution" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="tanni-print-dialog mx-auto mt-auto mb-0 max-h-[92vh] w-full max-w-[820px] rounded-t-2xl border-0 bg-zinc-200 p-0 text-zinc-900 backdrop:bg-black/45 dark:bg-zinc-900"
    >
      <style>{`
        @media print {
          .tanni-app-chrome, .tanni-dialog-chrome { display: none !important; }
          .tanni-print-dialog { position: static !important; inset: auto !important; margin: 0 !important;
            padding: 0 !important; border: 0 !important; max-width: none !important; max-height: none !important;
            width: auto !important; background: #fff !important; box-shadow: none !important; overflow: visible !important; }
          .tanni-print-dialog::backdrop { display: none !important; }
          .tanni-print-body { padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .tanni-print-sheet { width: auto !important; box-shadow: none !important; }
          @page { size: A4 portrait; margin: 14mm; }
        }
      `}</style>

      <div className="tanni-dialog-chrome sticky top-0 z-10 flex items-center gap-2.5 bg-teal-900 px-4 py-3.5 text-white">
        <b className="flex-1 text-[15px]">家族にわたす紙</b>
        <button type="button" onClick={() => window.print()} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          🖨 印刷する
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
          閉じる
        </button>
      </div>

      <div className="tanni-print-body max-h-[80vh] overflow-y-auto p-3.5">
        <div className="tanni-dialog-chrome mb-3.5 rounded-xl bg-white p-3.5 shadow-sm dark:bg-zinc-950">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400">お名前（任意）</label>
              <input
                type="text"
                value={printName}
                onChange={(e) => onPrintNameChange(e.target.value)}
                placeholder="例）山田 花子"
                autoComplete="off"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-500 dark:text-zinc-400">作成者・事業所名（任意）</label>
              <input
                type="text"
                value={printBy}
                onChange={(e) => onPrintByChange(e.target.value)}
                placeholder="例）○○居宅介護支援事業所　田中"
                autoComplete="off"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            お名前はこの端末に保存されません。事業所名だけ次回も使えるよう記憶します。
            <br />
            「印刷する」を押すと、スマホなら共有メニューからPDF保存もできます。
          </div>
        </div>

        <div className="tanni-dialog-chrome mb-2 px-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">印刷プレビュー（A4）</div>

        <div className="overflow-x-auto pb-2">
          <div className="tanni-print-sheet mx-auto w-[182mm] bg-white p-[6mm_6mm_4mm] text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.18)]" style={{ fontSize: "10.5pt", lineHeight: 1.6 }}>
            {!r || r.details.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">サービスを追加すると印刷内容が表示されます</div>
            ) : (
              <>
                {/* 見出し */}
                <div className="mb-[3.5mm] flex items-end gap-3 border-b-[2.5px] border-teal-700 pb-[2mm]">
                  <div>
                    <div className="text-[16pt] font-extrabold tracking-wide text-teal-700">介護サービス　ご利用料金のめやす</div>
                    <div className="mt-[1.5mm] text-[11pt] font-bold">
                      {printName ? printName + "　様　／　" : ""}
                      {要介護度}　／　自己負担 {割}割
                    </div>
                  </div>
                  <div className="ml-auto whitespace-nowrap text-[9pt] text-zinc-600">
                    {now.getFullYear()}年{now.getMonth() + 1}月　作成
                  </div>
                </div>

                {/* 結論 */}
                <div className="mb-[3.5mm] rounded-[3mm] border-[2.5px] border-teal-700 bg-teal-50 p-[3mm] text-center">
                  <div className="text-[11pt] font-bold text-teal-700">1か月のお支払いのめやす</div>
                  <div className="my-[0.6mm] text-[27pt] leading-[1.15] font-extrabold tracking-tight text-teal-700">{円(r.月額合計)}</div>
                  {r.高額該当 ? (
                    <div className="text-[9pt] text-zinc-600">
                      ※ このうち約 {円(r.高額払戻)} は後から戻ります（実質 約{円(r.月額合計_高額後)}）
                    </div>
                  ) : (
                    <div className="text-[9pt] text-zinc-600">この金額になる計算のしかたは、下でご説明しています</div>
                  )}
                </div>

                {/* 内訳 */}
                <div className="mb-[3mm] break-inside-avoid">
                  <div className="mb-[2mm] border-l-4 border-teal-700 pl-[2.5mm] text-[10.5pt] font-extrabold text-teal-700">お支払いの内訳</div>
                  <PrKv k="介護保険のサービス（自己負担分）" v={円(r.介護保険分自己負担)} />
                  {r.超過自己負担 ? <PrKv k="上限を超えた分（全額のご負担）" v={円(r.超過自己負担)} over /> : null}
                  {r.自費合計 ? <PrKv k="食事代・日用品など（保険の対象外）" v={円(r.自費合計)} /> : null}
                  <div className="mt-[0.8mm] flex items-center justify-between border-t-2 border-zinc-800 pt-[2mm] text-[11.5pt] font-extrabold">
                    <span>合計</span>
                    <b className="text-[16pt] text-teal-700">{円(r.月額合計)}</b>
                  </div>
                </div>

                {/* 上限メーター */}
                <div className="mb-[3mm] break-inside-avoid">
                  <div className="mb-[2mm] border-l-4 border-teal-700 pl-[2.5mm] text-[10.5pt] font-extrabold text-teal-700">
                    介護保険で使える上限に対して、いまどのくらい？
                  </div>
                  <div className="h-[7mm] overflow-hidden rounded-full border border-zinc-300 bg-zinc-100">
                    <div className={`h-full rounded-full ${帯色}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-[1.5mm] flex justify-between text-[10pt]">
                    <span>
                      {r.給付管理単位.toLocaleString()} / {r.限度額.toLocaleString()} 単位
                    </span>
                    <b className={r.帯 === "over" ? "text-red-700" : ""}>
                      {r.超過単位 ? `${r.超過単位.toLocaleString()}単位オーバー` : `残り ${r.残単位.toLocaleString()}単位`}
                    </b>
                  </div>
                  {r.超過単位 ? (
                    <div className="mt-[2.5mm] rounded-[2mm] border-[1.5px] border-red-300 bg-red-50 p-[2.5mm_3mm] text-[10pt] font-bold text-red-800">
                      上限を超えているため、{円(r.超過自己負担)} は介護保険が使えず全額のご負担になります。
                    </div>
                  ) : null}
                </div>

                {/* ご利用の内容 */}
                <div className="mb-[3mm] break-inside-avoid">
                  <div className="mb-[2mm] border-l-4 border-teal-700 pl-[2.5mm] text-[10.5pt] font-extrabold text-teal-700">ご利用いただくサービス</div>
                  <table className="w-full border-collapse text-[10pt]">
                    <thead>
                      <tr className="bg-teal-50 text-[9pt] text-teal-700">
                        <th className="border border-zinc-300 p-[1.8mm_2mm] text-left">サービス</th>
                        <th className="border border-zinc-300 p-[1.8mm_2mm] text-left">内容</th>
                        <th className="border border-zinc-300 p-[1.8mm_2mm] text-right">回数</th>
                        <th className="border border-zinc-300 p-[1.8mm_2mm] text-right">単位数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.details.map((d) => (
                        <tr key={d.id}>
                          <td className="border border-zinc-300 p-[1.4mm_2mm] align-top">{d.label.replace(/（.*/, "")}</td>
                          <td className="border border-zinc-300 p-[1.4mm_2mm] align-top text-[9pt] text-zinc-600">
                            {[d.軸1 !== "_" ? d.軸1 : null, d.軸2].filter(Boolean).join("／") || "―"}
                          </td>
                          <td className="border border-zinc-300 p-[1.4mm_2mm] text-right align-top whitespace-nowrap">
                            {d.包括 ? "月ぎめ" : `月 ${d.回数} ${サービス[d.service]?.freq === "per_day" ? "日" : "回"}`}
                          </td>
                          <td className="border border-zinc-300 p-[1.4mm_2mm] text-right align-top whitespace-nowrap">
                            {d.小計単位.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 用語のせつめい */}
                <div className="mb-[3mm] break-inside-avoid">
                  <div className="mb-[2mm] border-l-4 border-teal-700 pl-[2.5mm] text-[10.5pt] font-extrabold text-teal-700">
                    はじめての方へ（かんたんな用語のせつめい）
                  </div>
                  <dl className="text-[8.8pt] leading-[1.55]">
                    <div className="border-b border-dotted border-zinc-300 py-[0.6mm]">
                      <dt className="float-left clear-left w-[24mm] font-extrabold text-teal-700">単位</dt>
                      <dd className="ml-[24mm]">
                        サービスの値段は全国共通に「単位」で決められています。1単位は地域と種類により10.00〜11.40円、今回は約{r.平均単価.toFixed(2)}円です。
                      </dd>
                    </div>
                    <div className="border-b border-dotted border-zinc-300 py-[0.6mm]">
                      <dt className="float-left clear-left w-[24mm] font-extrabold text-teal-700">使える上限</dt>
                      <dd className="ml-[24mm]">
                        要介護度ごとに1か月に使える単位数の上限があります。{r.要介護度}の方は {r.限度額.toLocaleString()}単位。超えた分は介護保険が使えません。
                      </dd>
                    </div>
                    <div className="border-b border-dotted border-zinc-300 py-[0.6mm]">
                      <dt className="float-left clear-left w-[24mm] font-extrabold text-teal-700">負担割合</dt>
                      <dd className="ml-[24mm]">所得に応じて1〜3割。今回は{割}割です。毎年7月に届く「介護保険負担割合証」でご確認いただけます。</dd>
                    </div>
                    <div className="py-[0.6mm]">
                      <dt className="float-left clear-left w-[24mm] font-extrabold text-teal-700">保険の対象外</dt>
                      <dd className="ml-[24mm]">食事代・おやつ代・おむつ代・滞在費などは、上限とは関係なくそのままのお支払いになります。</dd>
                    </div>
                  </dl>
                </div>

                <div className="mb-[3mm] border-t border-zinc-300 pt-[2mm] text-[8.5pt] leading-[1.7] text-zinc-600">
                  <div>※ この金額はめやすです。実際のご請求は、その月の利用日数や事業所ごとの加算により前後します。</div>
                  <div>※ 正確な金額は、各事業所の重要事項説明書・料金表をご確認ください。</div>
                  <div>※ ご不明な点は、担当のケアマネジャーにお気軽におたずねください。</div>
                  {printBy ? <div className="mt-[2mm] font-bold text-zinc-800">作成：{printBy}</div> : null}
                </div>

                {/* 計算のしかた */}
                <div className="break-before-page">
                  <div className="mb-[2mm] border-l-4 border-teal-700 pl-[2.5mm] text-[10.5pt] font-extrabold text-teal-700">
                    どうやってこの金額になるの？（計算のしかた）
                  </div>
                  {steps.map((s) => (
                    <div
                      key={s.no}
                      className={`mb-[1mm] rounded-[2mm] border p-[1.3mm_3mm] break-inside-avoid ${
                        s.alert ? "border-red-300 bg-red-50" : "border-teal-100 bg-teal-50/30"
                      }`}
                    >
                      <div className="flex items-center gap-[2mm] text-[10pt] font-extrabold leading-snug">
                        <span
                          className={`flex size-[5.6mm] shrink-0 items-center justify-center rounded-full text-[9pt] font-extrabold text-white ${
                            s.alert ? "bg-red-700" : "bg-teal-700"
                          }`}
                        >
                          {s.no}
                        </span>
                        {s.title}
                      </div>
                      {s.lead ? <div className="ml-[7.2mm] mt-[0.4mm] mb-[0.8mm] text-[8.5pt] text-zinc-600">{s.lead}</div> : null}
                      {s.lines.length > 0 && (
                        <table className="ml-[7.2mm] w-[calc(100%-7.2mm)] border-collapse text-[9.3pt]">
                          <tbody>
                            {s.lines.map((ln, i) => (
                              <tr key={i}>
                                <td className="w-[38%] border-b border-dotted border-zinc-300 py-[0.65mm]">{ln.name}</td>
                                <td className="border-b border-dotted border-zinc-300 py-[0.65mm] text-[10pt] text-zinc-600">{ln.expr}</td>
                                <td className="border-b border-dotted border-zinc-300 py-[0.65mm] text-right font-bold whitespace-nowrap">{ln.val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="ml-[7.2mm] mt-[0.7mm] text-[9.5pt]">
                        → <b className={`text-[11pt] font-extrabold ${s.alert ? "text-red-700" : "text-teal-700"}`}>{s.total}</b>
                      </div>
                      {s.note ? <div className="ml-[7.6mm] mt-[1mm] text-[8.5pt] text-zinc-600">※ {s.note}</div> : null}
                    </div>
                  ))}
                  <div className="mt-[1.6mm] flex items-center justify-between gap-6 break-inside-avoid rounded-[3mm] border-[2.5px] border-teal-700 bg-teal-50 p-[2.4mm_4mm]">
                    <span className="text-[12pt] font-extrabold">1か月のお支払い合計</span>
                    <b className="text-[19pt] font-extrabold text-teal-700">{円(r.月額合計)}</b>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
