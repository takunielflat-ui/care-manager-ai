/* =====================================================================
 *  単位数シミュレーター 状態管理
 *  ---------------------------------------------------------------
 *  tanni-simulator/src/ui.js の State / newRow / applyJigyosho /
 *  要介護度に合わせて行を直す などをReactのuseReducer向けに移植したもの。
 *  計算そのものは lib/kaigo/calc.ts の純関数（無変更）を呼ぶだけで、
 *  ここにあるのは「入力フォームの状態」の管理だけ。
 * ===================================================================== */
"use client";

import {
  サービス,
  項目の対象,
  要介護度一覧,
  type サービス定義,
  type 要介護度,
  type 負担限度額段階,
} from "@/lib/kaigo/master";
import { 週回数から月回数, type 自費項目 } from "@/lib/kaigo/calc";

export interface 行state {
  id: number;
  service: string;
  軸1: string;
  軸2: string | null;
  jigyoshoId: string | null;
  mode: "週" | "月";
  週回数: number;
  月回数: number;
  manualUnits: string;
  処遇改善区分: string | null;
  加算率上書き: string;
  自費: 自費項目[];
}

export interface 事業所 {
  id: string;
  name: string;
  service: string;
  軸1?: string;
  軸2?: string | null;
  処遇改善区分?: string | null;
  加算率上書き?: string;
  manualUnits?: string;
  自費?: 自費項目[];
  _open?: boolean;
}

export interface 条件 {
  要介護度: 要介護度;
  地域区分: string;
  負担割合: number;
  高額区分: string;
  負担限度額段階: 負担限度額段階 | null;
  印刷作成者: string;
}

export interface AppState extends 条件 {
  印刷名: string;
  rows: 行state[];
  jigyosho: 事業所[];
  seq: number;
}

export const 既定条件: 条件 = {
  要介護度: "要介護2",
  地域区分: "その他",
  負担割合: 0.1,
  高額区分: "ippan",
  負担限度額段階: null,
  印刷作成者: "",
};

/* ---------------- localStorage（使えなければ何もしない） ---------------- */
const STORAGE_COND = "tanni:cond";
const STORAGE_JIGYOSHO = "tanni:jigyosho";

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できない環境ではあきらめる */
  }
}

export const saveCond = (s: AppState) =>
  saveLocal(STORAGE_COND, {
    要介護度: s.要介護度,
    地域区分: s.地域区分,
    負担割合: s.負担割合,
    高額区分: s.高額区分,
    負担限度額段階: s.負担限度額段階,
    印刷作成者: s.印刷作成者,
  });
export const saveJigyosho = (s: AppState) => saveLocal(STORAGE_JIGYOSHO, s.jigyosho);
export const loadCond = (): 条件 => ({ ...既定条件, ...loadLocal<Partial<条件>>(STORAGE_COND, {}) });
export const loadJigyosho = (): 事業所[] => loadLocal<事業所[]>(STORAGE_JIGYOSHO, []);

/* ---------------- 表の軸まわりのヘルパ ---------------- */
function tableOf(def: サービス定義) {
  return def.units || def.flatUnits || null;
}

export function axisInfo(def: サービス定義) {
  const t = tableOf(def);
  if (!t) return { hasL1: false, label1: null as string | null, label2: null as string | null, keys1: [] as string[] };
  const keys1 = Object.keys(t);
  const hasL1 = !(keys1.length === 1 && keys1[0] === "_");
  return {
    hasL1,
    label1: hasL1 ? def.axes?.[0] || "区分" : null,
    label2: hasL1 ? def.axes?.[1] || "区分" : def.axes?.[0] || "区分",
    keys1,
  };
}

/** serviceKey を渡すと、その要介護度で選べる項目だけに絞る */
export function keys2Of(def: サービス定義, k1: string, 度: 要介護度 | null, serviceKey: string): string[] {
  const t = tableOf(def);
  if (!t) return [];
  const lv = t[k1] ?? t["_"];
  if (!lv) return [];
  let ks = Object.keys(lv);
  if (度 && serviceKey && def.flatUnits) {
    const 予防 = 度.startsWith("要支援");
    const f = ks.filter((k) => {
      const s = 項目の対象(serviceKey, k);
      return s === "both" || (予防 ? s === "yobo" : s === "kaigo");
    });
    if (f.length) ks = f;
  }
  return ks;
}

export function 度が使えるか(
  def: サービス定義,
  k1: string,
  k2: string | null | undefined,
  度: 要介護度,
  serviceKey: string,
): boolean {
  if (def.manualOnly) return true;
  if (def.monthlyUnits && 度.startsWith("要支援")) return true;
  const t = tableOf(def);
  if (!t || k2 == null) return false;
  const lv = t[k1] ?? t["_"];
  if (!lv) return false;
  const cell = lv[k2];
  if (cell == null) return false;
  if (typeof cell === "number") {
    const s = 項目の対象(serviceKey || "", k2);
    if (s === "both") return true;
    return 度.startsWith("要支援") ? s === "yobo" : s === "kaigo";
  }
  return cell[度] != null;
}

const 正規化 = (s: string | null | undefined) => (s || "").replace(/［予防］|介護予防/g, "").trim();

/** その要介護度で選べる軸2を返す。既定が使えなければ代替（予防版など）を探す */
export function 有効な軸2(
  def: サービス定義,
  k1: string,
  k2: string | null | undefined,
  度: 要介護度,
  serviceKey: string,
): string | null {
  if (def.manualOnly) return k2 ?? null;
  if (k2 != null && 度が使えるか(def, k1, k2, 度, serviceKey)) return k2;
  const ks = keys2Of(def, k1, 度, serviceKey).filter((k) => 度が使えるか(def, k1, k, 度, serviceKey));
  if (!ks.length) return null;
  const n = 正規化(k2);
  return ks.find((k) => 正規化(k) === n) ?? ks[0];
}

/* ---------------- 行の生成 ---------------- */
export interface 行プリセット {
  service?: string;
  key?: string;
  軸1?: string;
  軸2?: string | null;
  週回数?: number;
  月回数?: number;
  mode?: "週" | "月";
  manualUnits?: string;
  処遇改善区分?: string | null;
  加算率上書き?: string;
  自費?: 自費項目[];
  jigyoshoId?: string | null;
}

export function newRow(seq: number, jigyoshoList: 事業所[], preset: 行プリセット = {}): 行state {
  const service = preset.service || preset.key || "通所リハビリテーション";
  const def = サービス[service];
  const ai = axisInfo(def);
  const k1 = preset.軸1 ?? (ai.hasL1 ? ai.keys1[0] : "_");
  const k2 = preset.軸2 ?? keys2Of(def, k1, null, service)[0] ?? null;
  const mode = preset.mode || (def.freq === "per_day" ? "月" : "週");
  const 週回数= preset.週回数 ?? 2;
  const row: 行state = {
    id: seq,
    service,
    軸1: k1,
    軸2: k2,
    jigyoshoId: preset.jigyoshoId ?? null,
    mode,
    週回数,
    月回数: preset.月回数 ?? 週回数から月回数(週回数),
    manualUnits: preset.manualUnits ?? "",
    処遇改善区分: preset.処遇改善区分 ?? (def.shogu && Object.keys(def.shogu)[0]) ?? null,
    加算率上書き: preset.加算率上書き ?? "",
    自費: preset.自費 ? JSON.parse(JSON.stringify(preset.自費)) : [],
  };
  // 同じサービスの事業所が登録済みなら自動で当てる（訪問先での操作を減らす）
  const j = jigyoshoList.find((x) => x.service === service);
  if (j && !preset.軸2) return applyJigyosho(row, jigyoshoList, j.id);
  return row;
}

export function applyJigyosho(row: 行state, jigyoshoList: 事業所[], jid: string | null): 行state {
  const j = jigyoshoList.find((x) => x.id === jid);
  if (!j) return { ...row, jigyoshoId: jid || null };
  const def = サービス[j.service];
  const ai = axisInfo(def);
  const 軸1 = j.軸1 ?? (ai.hasL1 ? ai.keys1[0] : "_");
  const 軸2 = j.軸2 ?? keys2Of(def, 軸1, null, j.service)[0] ?? null;
  return {
    ...row,
    jigyoshoId: jid || null,
    service: j.service,
    軸1,
    軸2,
    処遇改善区分: j.処遇改善区分 ?? null,
    加算率上書き: j.加算率上書き ?? "",
    自費: JSON.parse(JSON.stringify(j.自費 || [])),
    manualUnits: j.manualUnits || row.manualUnits,
  };
}

/** 要介護度を切り替えたとき、各行の区分を新しい度で使えるものに読み替える */
export function 要介護度に合わせて行を直す(rows: 行state[], 度: 要介護度): 行state[] {
  return rows.map((row) => {
    const def = サービス[row.service];
    if (!def || def.manualOnly) return row;
    const k2 = 有効な軸2(def, row.軸1, row.軸2, 度, row.service);
    return k2 != null ? { ...row, 軸2: k2 } : row;
  });
}

export function uid(): string {
  return "j" + Math.random().toString(36).slice(2, 9);
}

export const 要介護度候補 = 要介護度一覧;
