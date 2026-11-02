/* =====================================================================
 *  使える機能（権限）の判定のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/access.test.ts
 *
 *  ・expires_at が過ぎた行は「権限なし」（画面の振り分けでも API でも）
 *  ・x-user-features は外から送られても proxy.ts で必ず消して上書きする
 *  ・API はこのヘッダーに頼らず、毎回データベースで権限を確かめる
 *  ・アセスメントだけの人に経過記録（AIの課金）を開放しない
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  activeFeatures,
  ASSESSMENT_GUIDE_PATH,
  checkFeature,
  EMAIL_HEADER,
  FEATURES_HEADER,
  getFeatures,
  NO_ACCESS_PATH,
  parseFeaturesHeader,
  redirectFor,
  requiredFeature,
  setTrustedHeaders,
  type EntitlementRow,
  type Feature,
} from "./access.ts";

const NOW = new Date("2026-11-03T12:00:00+09:00");
const PAST = "2026-11-03T11:59:59+09:00";
const FUTURE = "2026-12-31T23:59:59+09:00";
const set = (...f: Feature[]) => new Set<Feature>(f);
const sorted = (s: Set<Feature>) => [...s].sort();

/** user_entitlements を読むだけの偽の Supabase。読んだ回数も数える */
function fakeSupabase(opts: { user?: { id: string; email?: string } | null; rows?: EntitlementRow[]; error?: boolean }) {
  const calls = { entitlements: 0 };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: opts.user ?? null } }) },
    from: (table: string) => {
      assert.equal(table, "user_entitlements");
      return {
        select: () => ({
          eq: async (column: string, value: string) => {
            calls.entitlements++;
            assert.equal(column, "user_id");
            assert.equal(value, opts.user?.id);
            return opts.error ? { data: null, error: { message: "boom" } } : { data: opts.rows ?? [], error: null };
          },
        }),
      };
    },
  };
  // テストでは必要なメソッドだけを持つ偽物を渡す
  return { supabase: supabase as unknown as Parameters<typeof checkFeature>[0], calls };
}

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "someone@example.com" };

/* ---------- 期限 ---------- */

test("期限：空欄は無期限、未来は有効、過ぎた行・ちょうどの行は権限なし", () => {
  assert.deepEqual(sorted(activeFeatures([{ feature: "assessment", expires_at: null }], NOW)), ["assessment"]);
  assert.deepEqual(sorted(activeFeatures([{ feature: "assessment", expires_at: FUTURE }], NOW)), ["assessment"]);
  assert.deepEqual(sorted(activeFeatures([{ feature: "assessment", expires_at: PAST }], NOW)), []);
  assert.deepEqual(sorted(activeFeatures([{ feature: "assessment", expires_at: NOW.toISOString() }], NOW)), []);
  // 片方だけ期限切れなら、もう片方だけ使える
  assert.deepEqual(
    sorted(activeFeatures([{ feature: "fifth_sheet", expires_at: PAST }, { feature: "assessment", expires_at: null }], NOW)),
    ["assessment"],
  );
});

test("想定外の機能名・読めない日付の行は無視する（課金を伴う機能を誤って開放しない）", () => {
  assert.deepEqual(sorted(activeFeatures([{ feature: "premium" }, { feature: null }], NOW)), []);
  assert.deepEqual(sorted(activeFeatures([{ feature: "fifth_sheet", expires_at: "いつか" }], NOW)), []);
  assert.deepEqual(sorted(activeFeatures(null, NOW)), []);
});

test("画面の振り分け用：期限切れの行しかない人は権限なし → 案内ページへ", async () => {
  const { supabase } = fakeSupabase({ user: USER, rows: [{ feature: "fifth_sheet", expires_at: PAST }, { feature: "assessment", expires_at: PAST }] });
  const features = await getFeatures(supabase, USER, NOW);
  assert.deepEqual(sorted(features), []);
  assert.equal(redirectFor("/", features), NO_ACCESS_PATH);
  assert.equal(redirectFor("/assessment", features), ASSESSMENT_GUIDE_PATH);
});

test("API用：期限切れなら 403、期限内なら通す", async () => {
  const expired = fakeSupabase({ user: USER, rows: [{ feature: "fifth_sheet", expires_at: PAST }] });
  const r1 = await checkFeature(expired.supabase, "fifth_sheet", NOW);
  assert.equal(r1.ok, false);
  assert.equal(!r1.ok && r1.status, 403);

  const valid = fakeSupabase({ user: USER, rows: [{ feature: "fifth_sheet", expires_at: FUTURE }] });
  const r2 = await checkFeature(valid.supabase, "fifth_sheet", NOW);
  assert.equal(r2.ok, true);
});

/* ---------- API はデータベースで確かめる ---------- */

test("API用：ログインしていなければ 401（データベースも読まない）", async () => {
  const { supabase, calls } = fakeSupabase({ user: null });
  const r = await checkFeature(supabase, "assessment", NOW);
  assert.deepEqual(r, { ok: false, status: 401, error: "ログインが必要です。" });
  assert.equal(calls.entitlements, 0);
});

test("API用：毎回データベースを読み、アセスメントだけの人に経過記録（AI）を通さない", async () => {
  const { supabase, calls } = fakeSupabase({ user: USER, rows: [{ feature: "assessment", expires_at: null }] });
  assert.equal((await checkFeature(supabase, "assessment", NOW)).ok, true);
  const r = await checkFeature(supabase, "fifth_sheet", NOW);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 403);
  assert.equal(calls.entitlements, 2);
});

test("API用：データベースの確認に失敗したら権限なし", async () => {
  const { supabase } = fakeSupabase({ user: USER, error: true });
  const r = await checkFeature(supabase, "assessment", NOW);
  assert.equal(r.ok, false);
});

test("運営者のアドレスは、データベースを見ずにすべての機能（締め出し防止）", async () => {
  const saved = process.env.UNLIMITED_GENERATION_EMAILS;
  process.env.UNLIMITED_GENERATION_EMAILS = "Owner@Example.com";
  try {
    const owner = { id: "22222222-2222-2222-2222-222222222222", email: "owner@example.com" };
    const { supabase, calls } = fakeSupabase({ user: owner, rows: [] });
    assert.deepEqual(sorted(await getFeatures(supabase, owner, NOW)), ["assessment", "fifth_sheet"]);
    assert.equal(calls.entitlements, 0);
  } finally {
    process.env.UNLIMITED_GENERATION_EMAILS = saved;
  }
});

/* ---------- 偽のヘッダー ---------- */

test("ヘッダー：外から送られた x-user-features / x-user-email は、未ログインなら消すだけ", () => {
  const h = new Headers({ [FEATURES_HEADER]: "assessment,fifth_sheet", [EMAIL_HEADER]: "fake@example.com", "x-user-plan": "full" });
  setTrustedHeaders(h, { features: null, email: null });
  assert.equal(h.get(FEATURES_HEADER), null);
  assert.equal(h.get(EMAIL_HEADER), null);
  assert.equal(h.get("x-user-plan"), null);
});

test("ヘッダー：ログイン済みなら、外から送られた値を消してデータベースで確かめた値で上書きする", () => {
  const h = new Headers({ [FEATURES_HEADER]: "assessment,fifth_sheet", [EMAIL_HEADER]: "fake@example.com" });
  setTrustedHeaders(h, { features: set("assessment"), email: "real@example.com" });
  assert.equal(h.get(FEATURES_HEADER), "assessment");
  assert.equal(h.get(EMAIL_HEADER), "real@example.com");

  // 権限が1つもない人は空（偽の値が残らない）
  const empty = new Headers({ [FEATURES_HEADER]: "fifth_sheet" });
  setTrustedHeaders(empty, { features: set(), email: "real@example.com" });
  assert.deepEqual(sorted(parseFeaturesHeader(empty.get(FEATURES_HEADER))), []);
});

test("ヘッダーを読む側：想定外の値は無視する", () => {
  assert.deepEqual(sorted(parseFeaturesHeader("fifth_sheet, assessment,premium,")), ["assessment", "fifth_sheet"]);
  assert.deepEqual(sorted(parseFeaturesHeader(null)), []);
});

/* ---------- 画面の振り分け ---------- */

test("画面ごとに必要な機能", () => {
  assert.equal(requiredFeature("/assessment"), "assessment");
  assert.equal(requiredFeature("/assessment/new"), "assessment");
  assert.equal(requiredFeature("/assessment/2f4a875c-d96d-4018-9e17-2abb2c66df24"), "assessment");
  for (const p of ["/", "/records", "/settings", "/help", "/assessments-old"]) assert.equal(requiredFeature(p), "fifth_sheet", p);
  assert.equal(requiredFeature(NO_ACCESS_PATH), null);
  assert.equal(requiredFeature(ASSESSMENT_GUIDE_PATH), null);
});

test("振り分け：権限ごとに、開けない画面は開ける画面へ回す", () => {
  const both = set("assessment", "fifth_sheet");
  const assessmentOnly = set("assessment");
  const fifthOnly = set("fifth_sheet");
  const none = set();

  // 両方ある：どこでも開ける。案内ページはトップへ戻す
  for (const p of ["/", "/records", "/help", "/assessment", "/assessment/new"]) assert.equal(redirectFor(p, both), null, p);
  assert.equal(redirectFor(NO_ACCESS_PATH, both), "/");
  assert.equal(redirectFor(ASSESSMENT_GUIDE_PATH, both), "/assessment");

  // アセスメントだけ（購入者）：経過記録の画面・使い方はアセスメント一覧へ
  for (const p of ["/", "/records", "/settings", "/help"]) assert.equal(redirectFor(p, assessmentOnly), "/assessment", p);
  assert.equal(redirectFor("/assessment/new", assessmentOnly), null);
  assert.equal(redirectFor(NO_ACCESS_PATH, assessmentOnly), "/assessment");

  // 経過記録だけ：アセスメントを開くと購入案内
  assert.equal(redirectFor("/", fifthOnly), null);
  assert.equal(redirectFor("/assessment", fifthOnly), ASSESSMENT_GUIDE_PATH);
  assert.equal(redirectFor(ASSESSMENT_GUIDE_PATH, fifthOnly), null);

  // 権限なし：アセスメントは購入案内、それ以外は案内ページ。案内ページ自体は開ける
  assert.equal(redirectFor("/", none), NO_ACCESS_PATH);
  assert.equal(redirectFor("/help", none), NO_ACCESS_PATH);
  assert.equal(redirectFor("/assessment/new", none), ASSESSMENT_GUIDE_PATH);
  assert.equal(redirectFor(NO_ACCESS_PATH, none), null);
  assert.equal(redirectFor(ASSESSMENT_GUIDE_PATH, none), null);
});

/* ---------- コードの約束ごと（見落とし防止） ---------- */

const SRC = join(import.meta.dirname, "..");
const routeFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });

test("API：単位数電卓以外のすべての API が requireFeature で権限を確かめ、ヘッダーを読まない", () => {
  const files = routeFiles(join(SRC, "app", "api"));
  assert.ok(files.length >= 10);
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    assert.ok(!code.includes("x-user-features") && !code.includes("FEATURES_HEADER"), `${file} がヘッダーを読んでいる`);
    if (file.includes("tanni-plans")) continue;
    const handlers = code.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
    const checks = code.match(/requireFeature\("(assessment|fifth_sheet)"\)/g) ?? [];
    assert.ok(handlers.length > 0, file);
    assert.equal(checks.length, handlers.length, `${file} に権限の確認がない処理がある`);
  }
  // AI を呼ぶ API は経過記録の権限で止める
  const generate = readFileSync(join(SRC, "app", "api", "generate", "route.ts"), "utf8");
  assert.ok(generate.includes('requireFeature("fifth_sheet")'));
});

test("proxy.ts：画面へ渡すヘッダーは、どの通り道でも setTrustedHeaders を通してから渡す", () => {
  const code = readFileSync(join(SRC, "proxy.ts"), "utf8");
  const nexts = code.match(/NextResponse\.next\(/g) ?? [];
  const trusted = code.match(/setTrustedHeaders\(/g) ?? [];
  assert.ok(nexts.length > 0);
  // NextResponse.next を呼ぶ数だけ、ヘッダーを作り直している
  assert.equal(trusted.length, nexts.length);
  assert.ok(!/NextResponse\.next\(\)/.test(code), "元のヘッダーのまま渡している所がある");
  assert.ok(!/headers:\s*request\.headers/.test(code), "元のヘッダーのまま渡している所がある");
});
