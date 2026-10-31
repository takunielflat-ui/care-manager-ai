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

import {
  anonymizeForAI,
  clearRestoreMap,
  containsOriginalTerm,
  createStreamRestorer,
  hasUnrestoredPlaceholder,
  restoreFromAI,
} from "./anonymize.ts";

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

/* ---------------------------------------------------------------------
 *  生成後の復元（restoreFromAI など）のテスト
 *  「AIの出力」はここで手書きしたダミー。実際のAPIは呼ばない。
 * ------------------------------------------------------------------- */

const ROUNDTRIP_NOTE = "さくら訪問介護の小林さんと、山田様宅で面談した。";

test("送信文に実名が入らず、AIの出力は実名に戻る", () => {
  const { displayName, note, restoreMap } = anonymizeForAI({ displayName: "山田 花子様", note: ROUNDTRIP_NOTE });
  assert.equal(displayName, "A様");
  assert.equal(note, "Y事業所のB様と、A様宅で面談した。");
  assert.equal(containsOriginalTerm(`${displayName}\n${note}`, restoreMap), false);

  const aiOutput = "Y事業所のB氏と、A様宅で面談し、事業所Yへ連絡した。";
  assert.equal(
    restoreFromAI(aiOutput, restoreMap),
    "さくら訪問介護の小林氏と、山田 花子様宅で面談し、さくら訪問介護へ連絡した。",
  );
});

test("実名が残った送信文は「実名あり」と判定する", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "山田 花子様", note: ROUNDTRIP_NOTE });
  assert.equal(containsOriginalTerm(ROUNDTRIP_NOTE, restoreMap), true);
});

test("敬称の表記ゆれ（さん/様/氏/全角）も戻す", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "佐藤様", note: "小林さん来訪。" });
  assert.equal(restoreFromAI("Bさん、B様、B氏、Ｂ氏", restoreMap), "小林さん、小林様、小林氏、小林氏");
});

test("病院・地名も種別語ごと戻す", () => {
  const { note, restoreMap } = anonymizeForAI({ displayName: "田中様", note: "さくら病院受診。御殿場市在住。" });
  assert.equal(note, "X病院受診。Z地域在住。");
  assert.equal(restoreFromAI("X病院を受診。Z地域に在住。", restoreMap), "さくら病院を受診。御殿場市に在住。");
});

test("辞書（known_names）由来の置き換えも戻す", () => {
  const { note, restoreMap } = anonymizeForAI(
    { displayName: "田中様", note: "ひだまりに通所。小林から電話。" },
    { person: ["小林"], hospital: [], facility: ["ひだまり"], place: [] },
  );
  assert.equal(note, "Y事業所に通所。B様から電話。");
  assert.equal(restoreFromAI("Y事業所に通所。B氏より電話あり。", restoreMap), "ひだまりに通所。小林氏より電話あり。");
});

test("複数の人・事業所を取り違えない（B/C、Y/Y2）", () => {
  const { note, restoreMap } = anonymizeForAI({
    displayName: "田中様",
    note: "小林さんと小川さん。そよ風デイサービスとひまわりホーム。",
  });
  assert.equal(note, "B様とC様。Y事業所とY2事業所。");
  assert.equal(
    restoreFromAI("C氏、B氏。Y2事業所、Y事業所。", restoreMap),
    "小川氏、小林氏。ひまわりホーム、そよ風デイサービス。",
  );
});

test("同じ名字は匿名化の段階で同じラベルになる（既知の制限：利用者名で戻る）", () => {
  const { note, restoreMap } = anonymizeForAI({ displayName: "山田 花子様", note: "ヘルパーの山田さん同席。" });
  assert.equal(note, "ヘルパーのA様同席。");
  assert.equal(restoreFromAI("ヘルパーのA氏が同席。", restoreMap), "ヘルパーの山田 花子氏が同席。");
});

test("敬称・種別語のない英字や一般語は書き換えない", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "田中様", note: "さくら病院受診。小林さん来訪。" });
  const text = "X線検査。ADL自立。Bより連絡。SpO2 98%。";
  assert.equal(restoreFromAI(text, restoreMap), text);
});

test("ストリーミングで差分がどこで切れても、まとめて復元した結果と同じになる", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "山田 花子様", note: ROUNDTRIP_NOTE });
  const aiOutput =
    "Y事業所のB氏と、A様宅で面談し、事業所Yへ連絡した。ADLは自立。" +
    "長い経過記録の本文がここに続く。".repeat(5) +
    "最後にB様へ説明した。";
  const expected = restoreFromAI(aiOutput, restoreMap);

  for (const size of [1, 2, 3, 5, 7, 40]) {
    const restorer = createStreamRestorer(restoreMap);
    let streamed = "";
    for (let i = 0; i < aiOutput.length; i += size) streamed += restorer.push(aiOutput.slice(i, i + size));
    streamed += restorer.flush();
    assert.equal(streamed, expected, `chunk size ${size}`);
  }
});

test("ストリーミング中もラベルのない部分は溜めすぎずに送る", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "田中様", note: "" });
  const restorer = createStreamRestorer(restoreMap);
  assert.notEqual(restorer.push("本人宅を訪問し、体調を確認した。食事は自立している。"), "");
});

test("復元漏れの検出：知らないラベルが残れば true、元の入力にある語は除く", () => {
  assert.equal(hasUnrestoredPlaceholder("小林氏と面談。", "小林さんと面談"), false);
  assert.equal(hasUnrestoredPlaceholder("D氏と面談。", "小林さんと面談"), true);
  assert.equal(hasUnrestoredPlaceholder("事業所Yに連絡。", ""), true);
  assert.equal(hasUnrestoredPlaceholder("A様と面談。", "A様\n面談"), false);
});

test("対応表は破棄できる（破棄後は何も戻さない）", () => {
  const { restoreMap } = anonymizeForAI({ displayName: "山田 花子様", note: ROUNDTRIP_NOTE });
  clearRestoreMap(restoreMap);
  assert.equal(restoreFromAI("B氏と面談。", restoreMap), "B氏と面談。");
});
