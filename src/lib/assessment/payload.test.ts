/* =====================================================================
 *  保存リクエストの検証（parseAssessmentPayload）のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/assessment/payload.test.ts
 *
 *  「テンプレートにない内容は受け付けない」「文章はサーバー側で作り直す」ことを確認する。
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseAssessmentPayload } from "./payload.ts";
import { TEMPLATE_VERSION } from "./templates.ts";

const valid = {
  displayName: "A様",
  assessedOn: "2026-10-27",
  family: ["長女"],
  includeUnconfirmed: false,
  selections: {
    ido_in_tool: "杖（T字）",
    ido_in_level: "自立",
    ido_out_tool: "杖（T字）",
    ido_out_level: "自立",
    kaji_chori: "長女",
    kihon_bed: ["手すり（ベッド用）"],
    shokuji_suibun: " コップ5杯程度 ",
  },
};

const errorOf = (body: unknown) => {
  const r = parseAssessmentPayload(body);
  assert.equal(r.ok, false);
  return r.ok ? "" : r.error;
};

test("正しい内容：DBに入れる形に整え、文章はサーバー側で作り直す", () => {
  const r = parseAssessmentPayload({ ...valid, generatedText: "画面から送られた文章は使わない" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.row.display_name, "A様");
  assert.equal(r.row.assessed_on, "2026-10-27");
  assert.deepEqual(r.row.family, ["長女"]);
  assert.equal(r.row.selections.shokuji_suibun, "コップ5杯程度");
  assert.equal(r.row.template_version, TEMPLATE_VERSION);
  assert.ok(r.row.generated_text.includes("屋内外とも、移動は杖（T字）使用で自立している。"));
  assert.ok(r.row.generated_text.includes("調理は長女が行っている。"));
  assert.ok(!r.row.generated_text.includes("画面から送られた"));
  assert.ok(!r.row.generated_text.includes("未確認"));
  assert.equal(r.row.unconfirmed_count, 72 - 7);
});

test("何も選んでいなくても、表示名と実施日があれば保存できる", () => {
  const r = parseAssessmentPayload({ ...valid, selections: {}, family: [], includeUnconfirmed: true });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.row.unconfirmed_count, 72);
});

test("表示名：空・長すぎるものは受け付けない", () => {
  assert.match(errorOf({ ...valid, displayName: "  " }), /表示名/);
  assert.match(errorOf({ ...valid, displayName: "あ".repeat(21) }), /20文字/);
});

test("実施日：形式が違う・存在しない日付は受け付けない", () => {
  assert.match(errorOf({ ...valid, assessedOn: "2026/10/27" }), /実施日/);
  assert.match(errorOf({ ...valid, assessedOn: "2026-02-30" }), /実施日/);
  assert.match(errorOf({ ...valid, assessedOn: undefined }), /実施日/);
});

test("続柄：重複・「家族」・多すぎるものは受け付けない", () => {
  assert.match(errorOf({ ...valid, family: ["長女", "長女"] }), /続柄/);
  assert.match(errorOf({ ...valid, family: ["家族"] }), /続柄/);
  assert.match(errorOf({ ...valid, family: Array.from({ length: 11 }, (_, i) => `孫${i}`) }), /続柄/);
});

test("選択：テンプレートにない項目・選択肢、登録していない続柄は受け付けない", () => {
  assert.match(errorOf({ ...valid, selections: { unknown_item: "x" } }), /ない項目/);
  assert.match(errorOf({ ...valid, selections: { kihon_negaeri: "とても元気" } }), /寝返り/);
  assert.match(errorOf({ ...valid, selections: { kaji_chori: "夫" } }), /調理/);
  // 続柄を登録しているときは「家族」も画面に出ないので受け付けない
  assert.match(errorOf({ ...valid, selections: { kaji_chori: "家族" } }), /調理/);
  // 1つだけ選ぶ項目に配列、複数選べる項目に文字列・空配列・重複
  assert.match(errorOf({ ...valid, selections: { kihon_negaeri: ["自立"] } }), /寝返り/);
  assert.match(errorOf({ ...valid, selections: { kihon_bed: "手すり（ベッド用）" } }), /ベッド周り/);
  assert.match(errorOf({ ...valid, selections: { kihon_bed: [] } }), /ベッド周り/);
  assert.match(errorOf({ ...valid, selections: { kihon_bed: ["特になし", "特になし"] } }), /ベッド周り/);
  // 自由入力が長すぎる
  assert.match(errorOf({ ...valid, selections: { shokuji_suibun: "あ".repeat(41) } }), /水分の量/);
});

test("形の崩れたリクエストは受け付けない", () => {
  assert.match(errorOf(null), /形式/);
  assert.match(errorOf({ ...valid, selections: [] }), /形式/);
  assert.match(errorOf({ ...valid, includeUnconfirmed: "yes" }), /形式/);
  assert.match(errorOf({ ...valid, family: "長女" }), /続柄/);
});
