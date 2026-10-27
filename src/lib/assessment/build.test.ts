/* =====================================================================
 *  選択式アセスメント 文章組み立て（buildAssessmentText）のテスト
 *  ---------------------------------------------------------------
 *    node --test src/lib/assessment/build.test.ts
 *
 *  「推測で埋めない（未選択は未確認）」「判断の言葉を入れない」ことを確認する。
 * ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAssessmentText, choicesFor, splitSections } from "./build.ts";
import { ITEMS, type Selections } from "./templates.ts";

const run = (selections: Selections, family: string[] = [], includeUnconfirmed = true) =>
  buildAssessmentText({ selections, family, includeUnconfirmed });

const REQUIRED = ITEMS.filter((i) => !i.optional);

test("何も選ばない：全項目が未確認になり、件数が必須項目の数と一致する", () => {
  const r = run({});
  assert.equal(REQUIRED.length, 72);
  assert.equal(r.unconfirmedCount, REQUIRED.length);
  assert.deepEqual([...r.unconfirmedItems].sort(), REQUIRED.map((i) => i.label).sort());
  assert.deepEqual([...r.unconfirmedIds].sort(), REQUIRED.map((i) => i.id).sort());
  for (const i of REQUIRED) assert.ok(r.text.includes(`【${i.label}：未確認】`), i.label);
  // 任意項目は出さない
  assert.ok(!r.text.includes("転倒した場所"));
  assert.ok(r.text.startsWith("【基本動作】\n【寝返り：未確認】"));
});

test("何も選ばない＋未確認を出さない：未確認の文が出ず、件数は数える", () => {
  const r = run({}, [], false);
  assert.equal(r.text, "");
  assert.ok(!r.text.includes("未確認"));
  assert.equal(r.unconfirmedCount, REQUIRED.length);
});

test("移動：屋内外が違うと2文に分かれる", () => {
  const { text } = run({
    ido_in_tool: "杖（T字）",
    ido_in_level: "自立",
    ido_out_tool: "シルバーカー",
    ido_out_level: "見守り",
  });
  assert.ok(text.includes("屋内の移動は杖（T字）使用で自立している。屋外の移動はシルバーカー使用で見守りが必要である。"));
});

test("移動：屋内外が同じなら1文にまとめる", () => {
  const { text } = run({
    ido_in_tool: "杖（T字）",
    ido_in_level: "自立",
    ido_out_tool: "杖（T字）",
    ido_out_level: "自立",
  });
  assert.ok(text.includes("屋内外とも、移動は杖（T字）使用で自立している。"));
  assert.ok(!text.includes("屋内の移動は"));
});

test("移動：補助具なし・手引き・屋外へは出ない", () => {
  const r = run({ ido_in_tool: "なし", ido_in_level: "手引き", ido_out_tool: "屋外へは出ない" });
  assert.ok(r.text.includes("屋内は手引きで移動している。屋外へは出ていない。"));
  // 屋外へは出ない → 屋外の介助の程度は未確認に数えない
  assert.ok(!r.unconfirmedItems.includes("屋外の介助の程度"));
  assert.ok(!r.unconfirmedItems.includes("屋内の介助の程度"));

  assert.ok(run({ ido_in_tool: "なし", ido_in_level: "見守り" }).text.includes("屋内の移動は補助具なしで見守りが必要である。"));
  assert.ok(run({ ido_in_tool: "杖（T字）", ido_in_level: "手引き" }).text.includes("屋内は杖（T字）を使用し、手引きで移動している。"));
});

test("続柄：調理・掃除・洗濯が長女なら1文にまとめる", () => {
  const { text } = run({ kaji_chori: "長女", kaji_soji: "長女", kaji_sentaku: "長女" }, ["長女"]);
  assert.ok(text.includes("調理・掃除・洗濯は長女が行っている。"));
});

test("続柄：登録した続柄で選択肢を作る。未登録なら「家族」のまま", () => {
  const chori = ITEMS.find((i) => i.id === "kaji_chori")!;
  const values = (family: string[]) => choicesFor(chori, family).map((c) => c.value);
  assert.deepEqual(values(["長女", "夫"]), [
    "本人",
    "本人（簡単なものだけ）",
    "長女",
    "夫",
    "ヘルパー",
    "配食・購入で対応",
    "長女とヘルパーで分担",
    "夫とヘルパーで分担",
  ]);
  assert.ok(values([]).includes("家族"));
  assert.ok(run({ kaji_chori: "家族" }).text.includes("調理は家族が行っている。"));
  // 登録していない続柄は受け付けない（勝手に決めない）
  assert.ok(run({ kaji_chori: "長女" }).unconfirmedItems.includes("調理"));
  assert.ok(run({ kaji_okane: "本人（夫が確認）" }, ["夫"]).text.includes("金銭管理は本人が行い、夫が確認している。"));
});

test("同じ値の項目をまとめる：一部だけ同じでもまとめる", () => {
  const { text } = run({ kihon_negaeri: "自立", kihon_okiagari: "一部介助", kihon_tachiagari: "自立" });
  assert.ok(text.includes("寝返り・立ち上がりは自立している。起き上がりは一部介助である。"));
  assert.ok(text.includes("立ち上がりは見守りが必要である。") === false);

  const koi = run({ koi_ue: "自立", koi_shita: "自立", koi_kutsu: "全介助" }).text;
  assert.ok(koi.includes("上衣・下衣の着脱は自立している。靴下・靴の着脱は全介助である。"));
});

test("排泄：昼と夜が同じなら1文、違えば2文", () => {
  const same = run({
    haisetsu_basho_hiru: "トイレ",
    haisetsu_basho_yoru: "トイレ",
    haisetsu_mono_hiru: ["リハビリパンツ", "尿とりパッド"],
    haisetsu_mono_yoru: ["尿とりパッド", "リハビリパンツ"],
  }).text;
  assert.ok(same.includes("日中・夜間ともトイレで排泄している。"));
  assert.ok(same.includes("日中・夜間とも尿とりパッド・リハビリパンツを使用している。"));

  const diff = run({ haisetsu_basho_hiru: "トイレ", haisetsu_basho_yoru: "ポータブルトイレ" }).text;
  assert.ok(diff.includes("日中はトイレで排泄している。夜間はポータブルトイレを使用している。"));
});

test("複数選択：「・」でつなぎ、「特になし」は他と一緒なら外す", () => {
  assert.ok(run({ fuku_kufu: ["お薬カレンダー", "一包化"] }).text.includes("服薬では一包化・お薬カレンダーを使用している。"));
  assert.ok(run({ kihon_bed: ["特になし"] }).text.includes("ベッド周りで使用しているものは特にない。"));
  const both = run({ kihon_bed: ["特になし", "手すり（ベッド用）"] }).text;
  assert.ok(both.includes("ベッド周りでは手すり（ベッド用）を使用している。"));
  assert.ok(!both.includes("特にない"));
});

test("訪問時に見られたこと：本人の様子と聞いた話で文を分ける", () => {
  const { text } = run({
    ninchi_houmon: ["同じ話を繰り返す", "置き忘れ・しまい忘れがあると聞いた", "日付・曜日を答えられなかった"],
  });
  assert.ok(
    text.includes("訪問時、同じ話を繰り返す様子がみられ、日付・曜日を答えられなかった。置き忘れ・しまい忘れがあると聞き取った。"),
  );
});

test("服薬なし：関連項目は未確認に数えない", () => {
  const r = run({ fuku_kanri: "服薬なし" });
  assert.ok(r.text.includes("現在、服薬はしていない。"));
  for (const label of ["薬を飲む動作", "服薬で工夫しているもの", "飲み忘れ"]) {
    assert.ok(!r.unconfirmedItems.includes(label), label);
    assert.ok(!r.text.includes(`【${label}：未確認】`), label);
  }
  assert.equal(r.unconfirmedCount, REQUIRED.length - 4);
  // 通院は服薬なしでも聞く
  assert.ok(r.unconfirmedItems.includes("通院"));
});

test("判断語チェック：どの選択肢を選んでも判断の言葉が文に出ない", () => {
  const BANNED = ["リスク", "思われる", "認知症", "低下"];
  const texts: string[] = [];
  for (const item of ITEMS) {
    if (item.type === "text") {
      texts.push(run({ [item.id]: "例" }).text);
      continue;
    }
    for (const ch of choicesFor(item, ["長女"])) {
      texts.push(run({ [item.id]: item.type === "multi" ? [ch.value] : ch.value }, ["長女"]).text);
    }
    if (item.type === "multi") {
      texts.push(run({ [item.id]: item.choices.map((c) => c.value) }).text);
    }
  }
  // 移動はすべての組み合わせ
  const tools = ITEMS.find((i) => i.id === "ido_out_tool")!.choices;
  const levels = ITEMS.find((i) => i.id === "ido_in_level")!.choices;
  for (const t of tools) for (const l of levels) {
    texts.push(run({ ido_out_tool: t.value, ido_out_level: l.value }).text);
  }

  for (const text of texts) {
    assert.ok(!text.includes("undefined"), text);
    for (const w of BANNED) assert.ok(!text.includes(w), `「${w}」が含まれている: ${text}`);
  }
});

test("セクションごとに分ける：見出しを除いた本文を、介護ソフトの欄ごとに貼れる形で返す", () => {
  const { text } = run({ kihon_negaeri: "自立", ido_in_tool: "杖（T字）", ido_in_level: "自立" }, [], false);
  assert.deepEqual(splitSections(text), [
    { title: "基本動作", body: "寝返りは自立している。" },
    { title: "移動", body: "屋内の移動は杖（T字）使用で自立している。" },
  ]);
  // 未確認も出す設定なら、全10セクションに分かれる
  assert.equal(splitSections(run({}).text).length, 10);
  assert.deepEqual(splitSections(""), []);
});
