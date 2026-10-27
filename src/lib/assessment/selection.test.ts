/* =====================================================================
 *  選択の操作（toggleChoice / dropUnavailable）のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/assessment/selection.test.ts
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAssessmentText } from "./build.ts";
import { dropUnavailable, toggleChoice } from "./selection.ts";
import { ITEMS } from "./templates.ts";

const item = (id: string) => ITEMS.find((i) => i.id === id)!;

test("1つだけ選ぶ項目：押すと選択、同じものをもう一度押すと取り消し、別のものを押すと切り替え", () => {
  let sel = toggleChoice({}, item("kihon_negaeri"), "自立");
  assert.deepEqual(sel, { kihon_negaeri: "自立" });
  sel = toggleChoice(sel, item("kihon_negaeri"), "見守り");
  assert.deepEqual(sel, { kihon_negaeri: "見守り" });
  sel = toggleChoice(sel, item("kihon_negaeri"), "見守り");
  assert.deepEqual(sel, {});
});

test("複数選べる項目：押すたびに付け外し。「特になし」は他と同時に選ばれない", () => {
  const bed = item("kihon_bed");
  let sel = toggleChoice({}, bed, "手すり（ベッド用）");
  sel = toggleChoice(sel, bed, "手すり（据え置き型）");
  assert.deepEqual(sel.kihon_bed, ["手すり（ベッド用）", "手すり（据え置き型）"]);
  sel = toggleChoice(sel, bed, "特になし");
  assert.deepEqual(sel.kihon_bed, ["特になし"]);
  sel = toggleChoice(sel, bed, "手すり（ベッド用）");
  assert.deepEqual(sel.kihon_bed, ["手すり（ベッド用）"]);
  sel = toggleChoice(sel, bed, "手すり（ベッド用）");
  assert.equal(sel.kihon_bed, undefined);
});

test("自由入力：空にすると未選択に戻る", () => {
  const suibun = item("shokuji_suibun");
  assert.deepEqual(toggleChoice({}, suibun, "コップ5杯程度"), { shokuji_suibun: "コップ5杯程度" });
  assert.deepEqual(toggleChoice({ shokuji_suibun: "x" }, suibun, "  "), {});
});

test("続柄を消すと、それを選んでいた項目は未選択に戻り、文章からも消える", () => {
  const sel = { kaji_chori: "長女", kaji_soji: "夫とヘルパーで分担", kaji_sentaku: "本人", ido_shudan: ["長女の送迎", "徒歩"] };
  const after = dropUnavailable(sel, ITEMS, ["夫"]);
  assert.deepEqual(after, { kaji_soji: "夫とヘルパーで分担", kaji_sentaku: "本人", ido_shudan: ["徒歩"] });

  const r = buildAssessmentText({ selections: after, family: ["夫"], includeUnconfirmed: true });
  assert.ok(r.unconfirmedIds.includes("kaji_chori"));
  assert.ok(!r.text.includes("長女"));
});

test("続柄を初めて登録すると、「家族」のままの選択は外れる（画面に出なくなるため）", () => {
  assert.deepEqual(dropUnavailable({ kaji_chori: "家族" }, ITEMS, ["長女"]), {});
  assert.deepEqual(dropUnavailable({ kaji_chori: "家族" }, ITEMS, []), { kaji_chori: "家族" });
});
