/* =====================================================================
 * 介護費用 計算エンジン
 * ---------------------------------------------------------------------
 *  純粋関数のみ。DOM も外部依存もありません。
 *
 *  ■計算の考え方（ここが実務上いちばん間違えやすい所）
 *
 *   1. 給付管理単位 = Σ((基本単位 + 回数ごとの加算) × 月回数)
 *        回数ごとの加算 = 入浴介助加算など（要介護のみ）。限度額の対象に含める。
 *        → 区分支給限度基準額と比べるのはこの数字。
 *
 *   2. 処遇改善加算 = 給付管理単位 × 加算率
 *        → 処遇改善加算は「区分支給限度基準額の対象外」。
 *          限度額の判定には含めず、費用の計算にだけ足す。
 *          ここを混ぜている簡易計算ツールが多い。
 *
 *   3. 限度額オーバー分は全額自己負担（10割）。
 *        超過単位をどのサービスから出すかはケアマネが選ぶ（超過割当）。
 *        超過単位にかかる処遇改善加算も、同じく10割負担側に入れる。
 *        費用 = floor((超過単位 + その処遇改善) × そのサービスの単価)
 *
 *   4. 限度額内の分は保険が効く。端数処理はサービスごとに行う。
 *        単価     = 地域区分 × そのサービスの人件費割合
 *        費用額   = floor(単位 × 単価)
 *        保険給付 = floor(費用額 × (1 − 負担割合))
 *        自己負担 = 費用額 − 保険給付
 *
 *   5. 自費項目（食費・おむつ代など）は単位数と無関係にそのまま加算。
 *
 *  ★2026-11: 平均単価でまとめて円換算する方式をやめ、サービスごとに
 *    円換算・端数処理してから合計する方式に変更（料金めやすPDF 改善依頼）。
 * ===================================================================== */

import { 限度額, 地域区分, サービス, 旧区分の読み替え, type 要介護度 } from "./master.ts";

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
  /** 回数ごとの加算の選択（加算key → 区分名。例: { 入浴: "Ⅰ" }） */
  加算選択?: Record<string, string | null> | null;
  自費?: 自費項目[];
}

export interface 計算入力 {
  要介護度: 要介護度;
  地域区分: string;
  負担割合?: number;
  高額上限?: number | null;
  /** 限度額を超えたとき、超過単位を先に割り当てる行の id。未指定なら一番下の行から */
  超過割当?: number | null;
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
  /** 1回（1日）あたりの加算単位の合計（入浴介助加算など） */
  加算単位: number;
  加算内訳: { label: string; 区分: string; 単位: number }[];
  回数: number;
  包括: boolean;
  小計単位: number;
  処遇改善率: number;
  処遇改善単位: number;
  単価: number;
  自費: number;
  限度額対象: boolean;
  verified: string;
  /** この行に割り当てた限度額超過単位（10割負担） */
  超過単位: number;
  /** 超過単位にかかる処遇改善加算（10割負担） */
  超過処遇改善単位: number;
  /** 保険が効く部分の費用額（円・切り捨て済み） */
  費用額: number;
  保険給付: number;
  /** 保険が効く部分の自己負担（費用額 − 保険給付） */
  自己負担: number;
  /** 超過分の費用（円・全額自己負担） */
  超過費用: number;
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
  /** 参考値（限度額対象サービスの加重平均単価）。計算には使っていない */
  平均単価: number;
  /** 超過単位を割り当てた行（超過がなければ空） */
  超過割当先: { id: number; label: string; 単位: number }[];
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

/** 地域単価を引く。人件費割合が0のサービス（福祉用具貸与など）は地域区分の影響を受けず常に10.00円 */
export function 単価を取得(地域id: string, 人件費割合: 70 | 55 | 45 | 0): number {
  if (人件費割合 === 0) return 10.0;
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
  const cell = k2 != null ? (lv1[k2] ?? lv1[旧区分の読み替え[k2]]) : (lv1 as unknown as number);
  if (cell == null) return 0;

  // flatUnits は数値が直接入っている
  if (typeof cell === "number") return cell;
  return cell[要介護度] ?? 0;
}

/**
 * 1サービス行の「回数ごとの加算」（入浴介助加算など）を引く。
 * 要介護の方の、回数で数えるサービスだけが対象（要支援・月額包括・手入力は対象外）。
 */
export function 回数加算を取得(row: 計算行, 要介護度: 要介護度): { label: string; 区分: string; 単位: number }[] {
  const def = サービス[row.service];
  if (!def?.kasan || !row.加算選択) return [];
  if (要介護度.startsWith("要支援") || は月額包括(row, 要介護度)) return [];
  if (row.manualUnits != null && row.manualUnits !== "") return [];
  const out: { label: string; 区分: string; 単位: number }[] = [];
  for (const k of def.kasan) {
    const 区分 = row.加算選択[k.key];
    if (区分 && k.options[区分] != null) out.push({ label: k.label, 区分, 単位: k.options[区分] });
  }
  return out;
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
  let 自費合計 = 0;

  for (const row of input.rows) {
    const def = サービス[row.service];
    if (!def) continue;

    const 単価 = 単価を取得(input.地域区分, def.jinkenhi);
    const 基本単位 = 単位数を取得(row, 度);
    const 包括 = は月額包括(row, 度);
    const 回数 = 包括 ? 1 : Number(row.月回数) || 0;
    const 加算内訳 = 回数加算を取得(row, 度);
    const 加算単位 = 加算内訳.reduce((a, k) => a + k.単位, 0);
    const 小計単位 = (基本単位 + 加算単位) * 回数;

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

    details.push({
      id: row.id,
      service: row.service,
      label: def.label,
      icon: def.icon,
      軸1: row.軸1,
      軸2: row.軸2,
      基本単位,
      加算単位,
      加算内訳,
      回数,
      包括,
      小計単位,
      処遇改善率: 率,
      処遇改善単位,
      単価,
      自費: 行自費,
      限度額対象: !!def.gendogaku,
      verified: def.verified,
      超過単位: 0,
      超過処遇改善単位: 0,
      費用額: 0,
      保険給付: 0,
      自己負担: 0,
      超過費用: 0,
    });
  }

  /* ---- 限度額の判定 ---- */
  const 対象行 = details.filter((d) => d.限度額対象);
  const 給付管理単位 = 対象行.reduce((a, d) => a + d.小計単位, 0);
  const 処遇改善単位_対象 = 対象行.reduce((a, d) => a + d.処遇改善単位, 0);
  const 限度内単位 = Math.min(給付管理単位, 限度);
  const 超過単位 = Math.max(0, 給付管理単位 - 限度);
  const 残単位 = Math.max(0, 限度 - 給付管理単位);
  const 使用率 = 限度 > 0 ? 給付管理単位 / 限度 : 0;

  /* ---- 超過単位をサービスに割り当てる ----
     指定された行から先に取り、足りなければ一番下の行から順に取る。 */
  if (超過単位 > 0) {
    const 順 = [...対象行].reverse();
    const 指定 = 順.findIndex((d) => d.id === input.超過割当);
    if (指定 > 0) 順.unshift(...順.splice(指定, 1));
    let 残り = 超過単位;
    for (const d of 順) {
      if (残り <= 0) break;
      const 取る = Math.min(残り, d.小計単位);
      d.超過単位 = 取る;
      残り -= 取る;
    }
  }

  /* ---- 費用の計算 ----
     サービスごとに「そのサービスの単価」で円にし、端数もサービスごとに処理してから合計する。
     超過単位とそれにかかる処遇改善加算は10割負担側に入れる。 */
  let 保険対象費用 = 0;
  let 保険給付 = 0;
  let 対象外費用 = 0;
  let 対象外給付 = 0;
  let 超過自己負担 = 0;
  for (const d of details) {
    d.超過処遇改善単位 =
      d.超過単位 > 0 ? Math.min(d.処遇改善単位, Math.round(d.超過単位 * (d.処遇改善率 / 100))) : 0;
    const 保険単位 = d.小計単位 - d.超過単位 + d.処遇改善単位 - d.超過処遇改善単位;
    d.費用額 = Math.floor(保険単位 * d.単価);
    d.保険給付 = Math.floor(d.費用額 * (1 - 割合));
    d.自己負担 = d.費用額 - d.保険給付;
    d.超過費用 = Math.floor((d.超過単位 + d.超過処遇改善単位) * d.単価);
    超過自己負担 += d.超過費用;
    if (d.限度額対象) {
      保険対象費用 += d.費用額;
      保険給付 += d.保険給付;
    } else {
      対象外費用 += d.費用額;
      対象外給付 += d.保険給付;
    }
  }
  const 保険内自己負担 = 保険対象費用 - 保険給付;
  const 対象外自己負担 = 対象外費用 - 対象外給付;

  // 参考表示用の加重平均単価（費用の計算には使わない）
  const 加重合計 = 対象行.reduce((a, d) => a + d.小計単位 * d.単価, 0);
  const 平均単価 = 給付管理単位 > 0 ? 加重合計 / 給付管理単位 : 10.0;
  const 超過割当先 = details
    .filter((d) => d.超過単位 > 0)
    .map((d) => ({ id: d.id, label: d.label.replace(/（.*/, ""), 単位: d.超過単位 }));

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
    超過割当先,
    保険対象費用,
    対象外費用,
    費用総額: 保険対象費用 + 対象外費用 + 超過自己負担,
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
  // 加算があれば「(777＋入浴40)単位」のように内訳を見せる
  const 単位の式 = (d: 明細行) =>
    d.加算単位 > 0
      ? `(${d.基本単位.toLocaleString()}＋${d.加算内訳.map((k) => k.label.replace(/介助加算$/, "") + k.単位).join("＋")})単位`
      : `${d.基本単位.toLocaleString()}単位`;

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
          expr: d.包括 ? "1か月ぶん" : `${単位の式(d)} × ${d.回数}${回の語(d)}`,
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
          : r.使用率 >= 0.9
            ? `残り ${r.残単位.toLocaleString()}単位（残りわずかです。加算などで超える可能性があります）`
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
        expr: d.包括 ? "1か月ぶん" : `${単位の式(d)} × ${d.回数}${回の語(d)}`,
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
      total: `処遇改善分を含めた合計 ${(r.給付管理単位 + r.処遇改善単位).toLocaleString()}単位`,
    });
  }

  /* 4. 単位 → 円（サービスごとに1行） */
  const 円の行 = r.details
    .filter((d) => d.費用額 > 0)
    .map((d) => ({
      name: d.label.replace(/（.*/, ""),
      expr: `${(d.小計単位 - d.超過単位 + d.処遇改善単位 - d.超過処遇改善単位).toLocaleString()}単位 × ${d.単価.toFixed(2)}円`,
      val: 円(d.費用額),
    }));
  steps.push({
    no: steps.length + 1,
    title: "「単位」を「円」になおします",
    lead:
      "1単位あたりの金額は、お住まいの地域とサービスの種類で決まります。サービスごとに円になおし、1円未満は切り捨てます。" +
      (r.超過単位 > 0 ? "上限を超えた分は、あとの手順で別に計算します。" : ""),
    lines: 円の行,
    total: `サービスの値段 ${円(r.保険対象費用 + r.対象外費用)}`,
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
      lead:
        `上限を超えて使った分（と、その分の処遇改善分）には介護保険が使えないため、10割のお支払いになります。` +
        `今回は「${r.超過割当先.map((x) => x.label).join("」「")}」のご利用分から超えた分として計算しています。`,
      lines: r.details
        .filter((d) => d.超過単位 > 0)
        .map((d) => ({
          name: d.label.replace(/（.*/, ""),
          expr:
            `${d.超過単位.toLocaleString()}単位` +
            (d.超過処遇改善単位 > 0 ? `＋処遇改善${d.超過処遇改善単位.toLocaleString()}単位` : "") +
            ` × ${d.単価.toFixed(2)}円`,
          val: 円(d.超過費用),
        })),
      total: `全額ご負担 ${円(r.超過自己負担)}`,
      alert: true,
    });
  }

  /* 7. 自費 */
  if (r.自費合計 > 0) {
    const lines: 計算ステップ行[] = [];
    for (const d of r.details) {
      if (!d.自費) continue;
      lines.push({ name: d.label.replace(/（.*/, ""), expr: 保険外の項目名(d.service), val: 円(d.自費) });
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

/** 保険外費用の項目名。短期入所は滞在費があるので明記する */
export function 保険外の項目名(serviceKey: string): string {
  return serviceKey.startsWith("短期入所") ? "食費・滞在費・日用品など" : "食費・日用品など";
}

/** 「あと何回入れられるか」を出す（限度額のこり ÷ そのサービスの1回単位） */
export function あと何回(結果: 計算結果, 一回単位: number): number | null {
  if (!一回単位) return null;
  return Math.floor(結果.残単位 / 一回単位);
}

export const 円 = (n: number): string => "¥" + Math.round(n).toLocaleString("ja-JP");
export const 単位 = (n: number): string => Math.round(n).toLocaleString("ja-JP") + "単位";
