/* =====================================================================
 *  使える機能の範囲（toAccessPlan / isAssessmentPath）のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/access.test.ts
 *
 *  「アセスメントだけの購入者に第5表（AIの課金）を開放しない」ことと、
 *  「plan 列を追加する前のDBでも今までどおり使える」ことを確認する。
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isAssessmentPath, toAccessPlan } from "./access.ts";

const NOW = new Date("2026-11-01T00:00:00+09:00");

test("登録がなければ使えない", () => {
  assert.equal(toAccessPlan(null, NOW), null);
});

test("plan 列がない（追加前の）行は、今までどおりすべての機能", () => {
  assert.equal(toAccessPlan({ expires_at: null }, NOW), "full");
});

test("plan の値どおりに範囲を決める", () => {
  assert.equal(toAccessPlan({ expires_at: null, plan: "full" }, NOW), "full");
  assert.equal(toAccessPlan({ expires_at: null, plan: "assessment" }, NOW), "assessment");
});

test("想定外の plan は使えない扱いにする", () => {
  assert.equal(toAccessPlan({ expires_at: null, plan: "premium" }, NOW), null);
  assert.equal(toAccessPlan({ expires_at: null, plan: null }, NOW), null);
});

test("期限切れなら plan にかかわらず使えない", () => {
  assert.equal(toAccessPlan({ expires_at: "2026-10-31T23:59:00+09:00", plan: "assessment" }, NOW), null);
  assert.equal(toAccessPlan({ expires_at: "2026-11-15T00:00:00+09:00", plan: "assessment" }, NOW), "assessment");
});

test("アセスメントの画面だけを、アセスメントだけの人に開ける", () => {
  assert.equal(isAssessmentPath("/assessment"), true);
  assert.equal(isAssessmentPath("/assessment/new"), true);
  assert.equal(isAssessmentPath("/assessment/2f4a875c-d96d-4018-9e17-2abb2c66df24"), true);
  assert.equal(isAssessmentPath("/"), false);
  assert.equal(isAssessmentPath("/records"), false);
  assert.equal(isAssessmentPath("/assessments-old"), false);
});
