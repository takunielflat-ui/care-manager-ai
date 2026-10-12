/* =====================================================================
 *  AI送信前の匿名化（anonymizeForAI）のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/anonymize.test.ts
 *
 *  ここに出てくる人名・地名・電話番号はすべて架空のダミー。実在の記録は使わない。
 *  「実名がAIに渡らない」ことと「一般語を壊さない」ことの両方を確認する。
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";

import { anonymizeForAI } from "./anonymize.ts";

const run = (displayName: string, note: string) => anonymizeForAI({ displayName, note });

test("表示名は敬称を外してラベルにする", () => {
  assert.equal(run("山田 花子様", "").displayName, "A様");
  assert.equal(run("A様", "").displayName, "A様");
});

test("表示名が敬称なしで本文に出てきても伏せる（フルネーム・姓・名）", () => {
  const { note } = run("山田 花子様", "山田花子 本人宅訪問。山田さんは「元気」と話す。花子は笑顔。");
  assert.equal(note, "A様 本人宅訪問。A様は「元気」と話す。A様は笑顔。");
});

test("イニシャルの表示名は本文から探さない（英字の単語を壊さない）", () => {
  assert.equal(run("A様", "ADLは自立。").note, "ADLは自立。");
});

test("続柄の後ろの名前は、続柄を残して名前だけ伏せる", () => {
  assert.equal(run("佐藤様", "長女恵子さん同席。").note, "長女B様同席。");
});

test("1文字の姓・カタカナの名前・ちゃん付けも伏せる", () => {
  assert.equal(run("佐藤様", "林さん（隣人）来訪。").note, "B様（隣人）来訪。");
  assert.equal(run("佐藤様", "トメさんと話す。").note, "B様と話す。");
  assert.equal(run("伊藤様", "ハルちゃんと呼ばれている。").note, "B様と呼ばれている。");
});

test("職種・続柄・一般語の「さん/様/氏」は伏せない", () => {
  const note =
    "訪問看護師さん、ヘルパーさん、ホームヘルパーさん、ケアマネージャーさんと調整。" +
    "次女さん来訪。皆さんでお茶。奥さんは不在。お母さん同席。";
  assert.equal(run("高橋様", note).note, note);
});

test("「様子」「様式」「同様」「氏名」「同氏」は人名として扱わない", () => {
  const note = "前回同様、様子に変わりなし。生活様式は維持。氏名の確認。同氏より連絡。";
  assert.equal(run("A様", note).note, note);
});

test("電話番号・郵便番号を伏せ、日付や数値は残す", () => {
  const { note } = run(
    "田中様",
    "電話 090-1234-5678、自宅 0312345678、〒123-4567。2026-10-12に訪問。体温36.5。血圧130/80。",
  );
  assert.equal(
    note,
    "電話 （電話番号）、自宅 （電話番号）、（郵便番号）。2026-10-12に訪問。体温36.5。血圧130/80。",
  );
});

test("病院・施設・地名は従来どおり種別を残して伏せる", () => {
  const { note } = run("田中様", "さくら病院受診。そよ風デイサービス利用。御殿場市在住。");
  assert.equal(note, "X病院受診。Y事業所利用。Z地域在住。");
});

test("辞書登録した語尾のない固有名詞を伏せる", () => {
  const { note } = anonymizeForAI(
    { displayName: "田中様", note: "ひだまりに通所。" },
    { person: [], hospital: [], facility: ["ひだまり"], place: [] },
  );
  assert.equal(note, "Y事業所に通所。");
});
