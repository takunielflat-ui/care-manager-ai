/* =====================================================================
 *  選択式アセスメント 選択の操作（画面から使う純粋関数）
 * ---------------------------------------------------------------------
 *  ★DOM も保存もしない。画面の状態（selections）を受け取って新しい状態を返すだけ。
 * ===================================================================== */
import { choicesFor } from "./build.ts";
import type { Item, Selections } from "./templates.ts";

/**
 * 選択肢を押したときの新しい selections。
 * ・1つだけ選ぶ項目：同じものをもう一度押すと取り消し
 * ・複数選べる項目：押すたびに付け外し。「特になし」を選ぶと他は外れ、他を選ぶと「特になし」が外れる
 * ・自由入力：value をそのまま入れる（空なら未選択に戻す）
 */
export function toggleChoice(sel: Selections, item: Item, value: string): Selections {
  const next = { ...sel };
  if (item.type === "text") {
    if (value.trim() === "") delete next[item.id];
    else next[item.id] = value;
    return next;
  }

  if (item.type === "single") {
    if (sel[item.id] === value) delete next[item.id];
    else next[item.id] = value;
    return next;
  }

  const current = Array.isArray(sel[item.id]) ? (sel[item.id] as string[]) : [];
  const noneValues = item.choices.filter((c) => c.none).map((c) => c.value);
  let values: string[];
  if (current.includes(value)) {
    values = current.filter((v) => v !== value);
  } else if (noneValues.includes(value)) {
    values = [value];
  } else {
    values = [...current.filter((v) => !noneValues.includes(v)), value];
  }
  if (values.length === 0) delete next[item.id];
  else next[item.id] = values;
  return next;
}

/**
 * 続柄を変えたあと、画面に出ていない選択肢の値を外す。
 * 例：「長女」を消したら、「長女」「長女とヘルパーで分担」を選んでいた項目は未選択に戻る。
 */
export function dropUnavailable(sel: Selections, items: Item[], family: string[]): Selections {
  const next: Selections = {};
  for (const item of items) {
    const raw = sel[item.id];
    if (raw === undefined) continue;
    if (item.type === "text") {
      next[item.id] = raw;
      continue;
    }
    const available = new Set(choicesFor(item, family).map((c) => c.value));
    if (Array.isArray(raw)) {
      const kept = raw.filter((v) => available.has(v));
      if (kept.length > 0) next[item.id] = kept;
    } else if (available.has(raw)) {
      next[item.id] = raw;
    }
  }
  return next;
}
