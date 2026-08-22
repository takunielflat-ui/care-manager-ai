/* =====================================================================
 * 介護費用 計算エンジン
 * ---------------------------------------------------------------------
 *  純粋関数のみ。DOM も外部依存もありません。
 *
 *  ■計算の考え方（ここが実務上いちばん間違えやすい所）
 *
 *   1. 給付管理単位 = Σ(基本単位 × 月回数)
 *        → 区分支給限度基準額と比べるのはこの数字。
 *
 *   2. 処遇改善加算 = 給付管理単位 × 加算率
 *        → 処遇改善加算は「区分支給限度基準額の対象外」。
 *          限度額の判定には含めず、費用の計算にだけ足す。
 *          ここを混ぜている簡易計算ツールが多い。
 *
 *   3. 限度額オーバー分は全額自己負担（10割）。
 *        費用 = 超過単位 × 単価
 *
 *   4. 限度額内の分は保険が効く。
 *        費用額 = floor(単位 × 地域単価)
 *        保険給付 = floor(費用額 × (1 − 負担割合))
 *        自己負担 = 費用額 − 保険給付
 *
 *   5. 自費項目（食費・おむつ代など）は単位数と無関係にそのまま加算。
 *
 *  ★数値・ロジックは tanni-simulator/src/calc.js から一切変更していません。
 *    型定義のみを追加しています(tanni-simulator/CLAUDE.md の指示)。
 * ===================================================================== */

import { 限度額, 地域区分, サービス, type 要介護度 } from "./master.ts";

export interface 自費項目 {
  name: string;
  unit: "回" | "日" | "月";
  amount: number;
  touched?: 1;
}

export interface 計算行 {
  id: number;
  service: string;
  軸1?: string | null;
  軸2?: string | null;
  manualUnits?: number | string | null;
  月回数?: number;
  処遇改善区分?: string | null;
  加算率上書き?: number | string | null;
  自費?: 自費項目[];
}

export interface 計算入力 {
  要介護度: 要介護度;
  地域区分: string;
  負担割合?: number;
  高額上限?: number | null;
  rows: 計算行[];
}

export interface 明細行 {
  id: number;
  service: string;
  label: string;
  icon: string;
  軸1?: string | null;
  軸2?: string | null;
  基本単位: number;
  回数: number;
  包括: boolean;
  小計単位: number;
  処遇改善率: number;
  処遇改善単位: number;
  単価: number;
  自費: number;
  限度額対象: boolean;
  verified: string;
}

export interface 計算結果 {
  要介護度: 要介護度;
  限度額: number;
  帯: "safe" | "caution" | "over";
  給付管理単位: number;
  処遇改善単位: number;
  総単位: number;
  限度内単位: number;
  超過単位: number;
  残単位: number;
  使用率: number;
  平均単価: number;
  保険対象費用: number;
  対象外費用: number;
  費用総額: number;
  保険給付: number;
  保険内自己負担: number;
  対象外自己負担: number;
  超過自己負担: number;
  自費合計: number;
  介護保険分自己負担: number;
  高額該当: boolean;
  高額払戻: number;
  月額合計: number;
  月額合計_高額後: number;
  details: 明細行[];
}

export interface 計算ステップ行 {
  name: string;
  expr: string;
  val: string;
}

export interface 計算ステップ項目 {
  no: number;
  title: string;
  lead?: string;
  lines: 計算ステップ行[];
  total: string;
  alert?: boolean;
  note?: string | null;
}

/** 週N回 → 月あたりの回数（概算）。1か月 ≒ 4.345週 */
export const 週回数から月回数 = (perWeek: number): number => Math.round(perWeek * 4.345);

/** 地域単価を引く */
export function 単価を取得(地域id: string, 人件費割合: 70 | 55 | 45): number {
  const area = 地域区分.find((a) => a.id === 地域id) || 地域区分[地域区分.length - 1];
  return area.単価[人件費割合] ?? 10.0;
}

/**
 * 1サービス行の単位数を引く
 */
export function 単位数を取得(row: 計算行, 要介護度: 要介護度): number {
  const def = サービス[row.service];
  if (!def) return 0;
  if (row.manualUnits != null && row.manualUnits !== "") return Number(row.manualUnits) || 0;

  // 要支援で月額包括のパターン（介護予防通所リハ）
  if (def.monthlyUnits && 要介護度.startsWith("要支援")) {
    return def.monthlyUnits[要介護度] ?? 0;
  }

  const table = def.units || def.flatUnits;
  if (!table) return 0;

  const k1 = row.軸1 ?? "_";
  const lv1 = table[k1] ?? table["_"];
  if (!lv1) return 0;

  const k2 = row.軸2;
  const cell = k2 != null ? lv1[k2] : (lv1 as unknown as number);
  if (cell == null) return 0;

  // flatUnits は数値が直接入っている
  if (typeof cell === "number") return cell;
  return cell[要介護度] ?? 0;
}

/** 要支援で月額包括になるサービスか */
export function は月額包括(row: 計算行, 要介護度: 要介護度): boolean {
  const def = サービス[row.service];
  if (!def) return false;
  if (def.freq === "monthly") return true;
  if (def.monthlyUnits && 要介護度.startsWith("要支援")) return true;
  return false;
}

/**
 * メイン計算
 */
export function 計算(input: 計算入力): 計算結果 {
  const 度 = input.要介護度;
  const 割合 = input.負担割合 ?? 0.1;
  const 限度 = 限度額[度] ?? 0;

  const details: 明細行[] = [];
  let 給付管理単位 = 0; // 限度額の対象になる単位
  let 対象外単位費用 = 0; // 限度額対象外サービスの費用（円）
  let 対象外自己負担 = 0;
  let 自費合計 = 0;
  let 処遇改善単位_対象 = 0; // 限度額対象サービスに乗る処遇改善（限度管理の外）

  for (const row of input.rows) {
    const def = サービス[row.service];
    if (!def) continue;

    const 単価 = 単価を取得(input.地域区分, def.jinkenhi);
    const 基本単位 = 単位数を取得(row, 度);
    const 包括 = は月額包括(row, 度);
    const 回数 = 包括 ? 1 : Number(row.月回数) || 0;
    const 小計単位 = 基本単位 * 回数;

    // 処遇改善加算率
    let 率 = 0;
    if (row.加算率上書き != null && row.加算率上書き !== "") {
      率 = Number(row.加算率上書き) || 0;
    } else if (row.処遇改善区分 && def.shogu && def.shogu[row.処遇改善区分] != null) {
      率 = def.shogu[row.処遇改善区分];
    }
    const 処遇改善単位 = Math.round(小計単位 * (率 / 100));

    // 自費
    let 行自費 = 0;
    for (const j of row.自費 || []) {
      const amt = Number(j.amount) || 0;
      if (j.unit === "月") 行自費 += amt;
      else 行自費 += amt * 回数; // '回' も '日' も回数ぶん
    }
    自費合計 += 行自費;

    if (def.gendogaku) {
      給付管理単位 += 小計単位;
      処遇改善単位_対象 += 処遇改善単位;
    } else {
      const 費用 = Math.floor((小計単位 + 処遇改善単位) * 単価);
      const 給付 = Math.floor(費用 * (1 - 割合));
      対象外単位費用 += 費用;
      対象外自己負担 += 費用 - 給付;
    }

    details.push({
      id: row.id,
      service: row.service,
      label: def.label,
      icon: def.icon,
      軸1: row.軸1,
      軸2: row.軸2,
      基本単位,
      回数,
      包括,
      小計単位,
      処遇改善率: 率,
      処遇改善単位,
      単価,
      自費: 行自費,
      限度額対象: !!def.gendogaku,
      verified: def.verified,
    });
  }

  /* ---- 限度額の判定 ---- */
  const 限度内単位 = Math.min(給付管理単位, 限度);
  const 超過単位 = Math.max(0, 給付管理単位 - 限度);
  const 残単位 = Math.max(0, 限度 - 給付管理単位);
  const 使用率 = 限度 > 0 ? 給付管理単位 / 限度 : 0;

  /* ---- 費用の計算 ----
     複数サービスで単価が違うため、限度額対象分は「加重平均単価」で概算する。
     （実際の給付管理でも超過分をどのサービスに割り当てるかは事業所次第のため、
       ここは概算と割り切るのが実務的） */
  let 加重合計 = 0;
  for (const d of details) {
    if (d.限度額対象) 加重合計 += d.小計単位 * d.単価;
  }
  const 平均単価 = 給付管理単位 > 0 ? 加重合計 / 給付管理単位 : 10.0;

  // 処遇改善加算も同じ平均単価で円換算（限度額の外なので全額が保険対象）
  const 保険対象費用 = Math.floor((限度内単位 + 処遇改善単位_対象) * 平均単価);
  const 保険給付 = Math.floor(保険対象費用 * (1 - 割合));
  const 保険内自己負担 = 保険対象費用 - 保険給付;
  const 超過自己負担 = Math.floor(超過単位 * 平均単価); // 全額自己負担

  const 介護保険分自己負担 = 保険内自己負担 + 対象外自己負担;
  const 高額上限 = input.高額上限;
  const 高額該当 = 高額上限 != null && 介護保険分自己負担 > 高額上限;
  const 高額払戻 = 高額該当 ? 介護保険分自己負担 - 高額上限 : 0;

  const 月額合計 = 介護保険分自己負担 + 超過自己負担 + 自費合計;
  const 月額合計_高額後 = 月額合計 - 高額払戻;

  /* 限度額の使用状況を3段階に。UIの色分け（緑／黄／赤）に使う */
  const 帯: "safe" | "caution" | "over" = 超過単位 > 0 ? "over" : 使用率 >= 0.9 ? "caution" : "safe";

  return {
    要介護度: 度,
    限度額: 限度,
    帯,
    給付管理単位,
    処遇改善単位: 処遇改善単位_対象,
    総単位: 給付管理単位 + 処遇改善単位_対象,
    限度内単位,
    超過単位,
    残単位,
    使用率,
    平均単価,
    保険対象費用,
    対象外費用: 対象外単位費用,
    費用総額: 保険対象費用 + 対象外単位費用 + 超過自己負担,
    保険給付,
    保険内自己負担,
    対象外自己負担,
    超過自己負担,
    自費合計,
    介護保険分自己負担,
    高額該当,
    高額払戻,
    月額合計,
    月額合計_高額後,
    details,
  };
}

/**
 * 家族向けの「計算のしかた」を組み立てる。
 * 計算(input) の結果をそのまま渡す。返り値は表示用のステップ配列で、
 * 最後のステップの金額が 結果.月額合計 と必ず一致する。
 */
export function 計算ステップ(r: 計算結果, 負担割合: number): { steps: 計算ステップ項目[]; 合計: number } {
  const 割 = Math.round(負担割合 * 10);
  const steps: 計算ステップ項目[] = [];
  const 回の語 = (d: 明細行) => (サービス[d.service]?.freq === "per_day" ? "日" : "回");

  if (r.給付管理単位 > 0) {
    /* 1. サービスごとの単位数 */
    steps.push({
      no: 1,
      title: "サービスの「単位数」を数えます",
      lead: "介護サービスの値段は「単位」で決められています。使う回数をかけて合計します。",
      lines: r.details
        .filter((d) => d.限度額対象)
        .map((d) => ({
          name: d.label.replace(/（.*/, ""),
          expr: d.包括 ? "1か月ぶん" : `${d.基本単位.toLocaleString()}単位 × ${d.回数}${回の語(d)}`,
          val: `${d.小計単位.toLocaleString()}単位`,
        })),
      total: `合計 ${r.給付管理単位.toLocaleString()}単位`,
    });

    /* 2. 上限との比較 */
    steps.push({
      no: 2,
      title: "介護保険で使える上限とくらべます",
      lead: `${r.要介護度}の方が1か月に使える上限は ${r.限度額.toLocaleString()}単位です。`,
      lines: [
        { name: "使う単位数", expr: "", val: `${r.給付管理単位.toLocaleString()}単位` },
        { name: "使える上限", expr: "", val: `${r.限度額.toLocaleString()}単位` },
      ],
      total:
        r.超過単位 > 0
          ? `${r.超過単位.toLocaleString()}単位ぶん オーバー`
          : `残り ${r.残単位.toLocaleString()}単位（まだ余裕があります）`,
      alert: r.超過単位 > 0,
    });
  } else if (r.対象外費用 > 0) {
    /* 限度額のわく外のサービスだけのとき（グループホーム・有料老人ホームなど） */
    steps.push({
      no: 1,
      title: "サービスの「単位数」を数えます",
      lead: "このサービスは「区分支給限度基準額（使える上限）」のわくの外にあるため、上限とのくらべ合わせはありません。",
      lines: r.details.map((d) => ({
        name: d.label.replace(/（.*/, ""),
        expr: d.包括 ? "1か月ぶん" : `${d.基本単位.toLocaleString()}単位 × ${d.回数}${回の語(d)}`,
        val: `${(d.小計単位 + d.処遇改善単位).toLocaleString()}単位`,
      })),
      total: `サービスの値段 ${円(r.対象外費用)}`,
    });
  }

  /* 3. 処遇改善加算 */
  if (r.処遇改善単位 > 0) {
    steps.push({
      no: steps.length + 1,
      title: "職員の処遇改善分を足します",
      lead: "介護で働く人の給与に充てるための上乗せです。この分は上限には含まれません。",
      lines: r.details
        .filter((d) => d.限度額対象 && d.処遇改善単位 > 0)
        .map((d) => ({
          name: d.label.replace(/（.*/, ""),
          expr: `${d.小計単位.toLocaleString()}単位 × ${d.処遇改善率}％`,
          val: `＋${d.処遇改善単位.toLocaleString()}単位`,
        })),
      total: `合計 ${(r.限度内単位 + r.処遇改善単位).toLocaleString()}単位`,
    });
  }

  /* 4. 単位 → 円 */
  const 端数 = Math.abs(r.平均単価 - Math.round(r.平均単価 * 100) / 100) > 0.0001;
  steps.push({
    no: steps.length + 1,
    title: "「単位」を「円」になおします",
    lead: `1単位あたりの金額は、お住まいの地域とサービスの種類で決まります（今回は1単位＝約${r.平均単価.toFixed(2)}円）。`,
    lines: [
      {
        name: "サービスの値段（全額）",
        expr: `${(r.限度内単位 + r.処遇改善単位).toLocaleString()}単位 × ${r.平均単価.toFixed(2)}円`,
        val: 円(r.保険対象費用),
      },
      ...(r.対象外費用 > 0
        ? [{ name: "上限のわく外のサービス", expr: "施設のご利用分など", val: 円(r.対象外費用) }]
        : []),
    ],
    total: `サービスの値段 ${円(r.保険対象費用 + r.対象外費用)}`,
    note: 端数 ? "サービスごとに1単位の金額が違うため、平均でおおよそを出しています。" : null,
  });

  /* 5. 負担割合 */
  steps.push({
    no: steps.length + 1,
    title: `このうち ${割}割 がご本人のご負担です`,
    lead: `残りの ${10 - 割}割は介護保険から支払われます。`,
    lines: [
      { name: "サービスの値段（全額）", expr: "", val: 円(r.保険対象費用 + r.対象外費用) },
      {
        name: "介護保険が払う分",
        expr: `${10 - 割}割`,
        val: "− " + 円(r.保険対象費用 + r.対象外費用 - r.介護保険分自己負担),
      },
    ],
    total: `ご負担 ${円(r.介護保険分自己負担)}`,
  });

  /* 6. 限度額オーバー分 */
  if (r.超過自己負担 > 0) {
    steps.push({
      no: steps.length + 1,
      title: "上限を超えた分は全額のご負担になります",
      lead: "上限を超えて使った分には介護保険が使えないため、10割のお支払いになります。",
      lines: [
        {
          name: "オーバーした分",
          expr: `${r.超過単位.toLocaleString()}単位 × ${r.平均単価.toFixed(2)}円`,
          val: 円(r.超過自己負担),
        },
      ],
      total: `全額ご負担 ${円(r.超過自己負担)}`,
      alert: true,
    });
  }

  /* 7. 自費 */
  if (r.自費合計 > 0) {
    const lines: 計算ステップ行[] = [];
    for (const d of r.details) {
      if (!d.自費) continue;
      lines.push({ name: d.label.replace(/（.*/, ""), expr: "食費・日用品など", val: 円(d.自費) });
    }
    steps.push({
      no: steps.length + 1,
      title: "介護保険の対象外のお支払いを足します",
      lead: "食事代やおむつ代などは介護保険の対象外なので、そのままのお支払いになります。",
      lines,
      total: `保険外 ${円(r.自費合計)}`,
    });
  }

  return { steps, 合計: r.月額合計 };
}

/** 「あと何回入れられるか」を出す（限度額のこり ÷ そのサービスの1回単位） */
export function あと何回(結果: 計算結果, 一回単位: number): number | null {
  if (!一回単位) return null;
  return Math.floor(結果.残単位 / 一回単位);
}

export const 円 = (n: number): string => "¥" + Math.round(n).toLocaleString("ja-JP");
export const 単位 = (n: number): string => Math.round(n).toLocaleString("ja-JP") + "単位";
