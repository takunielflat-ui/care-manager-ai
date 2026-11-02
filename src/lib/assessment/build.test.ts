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
import { ITEMS, SECTIONS, type Notes, type Selections } from "./templates.ts";

const run = (selections: Selections, family: string[] = [], includeUnconfirmed = true, notes: Notes = {}) =>
  buildAssessmentText({ selections, family, includeUnconfirmed, notes });

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

test("文体：文末に「している」「である」「と聞き取った」を付けない", () => {
  const texts: string[] = [];
  for (const item of ITEMS) {
    if (item.type === "text") {
      texts.push(run({ [item.id]: "例" }, [], false).text);
      continue;
    }
    for (const ch of choicesFor(item, ["長女"])) {
      texts.push(run({ [item.id]: item.type === "multi" ? [ch.value] : ch.value }, ["長女"], false).text);
    }
  }
  for (const text of texts) {
    assert.ok(!/(している|である)。/.test(text), text);
    assert.ok(!text.includes("聞き取った"), text);
  }
});

test("移動：屋内外が違うと2文に分かれる", () => {
  const { text } = run({
    ido_in_tool: "杖（T字）",
    ido_in_level: "自立",
    ido_out_tool: "シルバーカー",
    ido_out_level: "見守り",
  });
  assert.ok(text.includes("屋内は杖（T字）で自立。屋外はシルバーカーで見守り。"));
});

test("移動：屋内外が同じなら1文にまとめる", () => {
  const { text } = run({
    ido_in_tool: "杖（T字）",
    ido_in_level: "自立",
    ido_out_tool: "杖（T字）",
    ido_out_level: "自立",
  });
  assert.ok(text.includes("屋内外とも杖（T字）で自立。"));
  assert.ok(!text.includes("屋内は"));
  // 見出しで分かることは繰り返さない
  assert.ok(!text.includes("移動は"));
});

test("移動：補助具なし・手引き・屋外へは出ない・転倒", () => {
  const r = run({ ido_in_tool: "なし", ido_in_level: "手引き", ido_out_tool: "屋外へは出ない" });
  assert.ok(r.text.includes("屋内は手引きで移動。屋外へは出ない。"));
  // 屋外へは出ない → 屋外の介助の程度は未確認に数えない
  assert.ok(!r.unconfirmedItems.includes("屋外の介助の程度"));
  assert.ok(!r.unconfirmedItems.includes("屋内の介助の程度"));

  assert.ok(run({ ido_in_tool: "なし", ido_in_level: "自立" }).text.includes("屋内は補助具なしで自立。"));
  assert.ok(run({ ido_in_tool: "歩行車（キャスター付き）", ido_in_level: "一部介助" }).text.includes("屋内は歩行車（キャスター付き）で一部介助。"));
  assert.ok(run({ ido_in_tool: "杖（T字）", ido_in_level: "手引き" }).text.includes("屋内は杖（T字）を使用し、手引きで移動。"));

  assert.ok(run({ ido_tento: "直近1年で複数回" }).text.includes("直近1年で複数回転倒あり。"));
  assert.ok(run({ ido_tento: "直近1年でなし" }).text.includes("直近1年の転倒なし。"));
  assert.ok(run({ ido_tento: "最近転びそうになることがある" }).text.includes("最近、転びそうになることがある。"));
});

test("続柄：調理・掃除・洗濯が長女なら1文にまとめる", () => {
  const { text } = run({ kaji_chori: "長女", kaji_soji: "長女", kaji_sentaku: "長女" }, ["長女"]);
  assert.ok(text.includes("調理・掃除・洗濯は長女。"));
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
    "施設の食事で対応",
  ]);
  assert.ok(values([]).includes("家族"));
  assert.ok(run({ kaji_chori: "家族" }).text.includes("調理は家族。"));
  // 登録していない続柄は受け付けない（勝手に決めない）
  assert.ok(run({ kaji_chori: "長女" }).unconfirmedItems.includes("調理"));
  assert.ok(run({ kaji_okane: "本人（夫が確認）" }, ["夫"]).text.includes("金銭管理は本人（夫が確認）。"));
  assert.ok(run({ shokuji_junbi: "長女が作る" }, ["長女"]).text.includes("食事の準備は長女。"));
});

test("施設の選択肢：住まいが施設の人向けの選択肢が出て、文になる", () => {
  const values = (id: string) => choicesFor(ITEMS.find((i) => i.id === id)!, []).map((c) => c.value);
  assert.ok(values("ido_shudan").includes("施設の送迎"));
  assert.ok(values("shokuji_junbi").includes("施設の食事"));
  assert.ok(values("nyuyoku_basho").includes("住まいの施設の浴室（住宅型有料老人ホーム・サ高住等）"));
  assert.ok(values("seiyo_tsume").includes("施設職員が行っている"));
  assert.ok(values("fuku_kanri").includes("施設職員が管理"));
  assert.ok(values("fuku_tsukisoi").includes("施設職員"));
  for (const id of ["kaji_soji", "kaji_sentaku", "kaji_kaimono", "kaji_gomi"]) assert.ok(values(id).includes("施設職員"), id);
  assert.ok(values("kaji_okane").includes("施設で預かり管理"));
  assert.ok(values("kaji_shorui").includes("施設職員が受け取り"));

  const { text } = run({
    nyuyoku_basho: "住まいの施設の浴室（住宅型有料老人ホーム・サ高住等）",
    nyuyoku_kaisu: "週2回",
    fuku_kanri: "施設職員が管理",
    kaji_soji: "施設職員",
    kaji_sentaku: "施設職員",
    kaji_okane: "施設で預かり管理",
  });
  assert.ok(text.includes("住まいの施設の浴室で週2回入浴。"));
  assert.ok(text.includes("薬は施設職員が管理。"));
  assert.ok(text.includes("掃除・洗濯は施設職員。"));
  assert.ok(text.includes("金銭管理は施設で預かり管理。"));
});

test("同じ値の項目をまとめる：一部だけ同じでもまとめる", () => {
  const { text } = run({ kihon_negaeri: "自立", kihon_okiagari: "一部介助", kihon_tachiagari: "自立" });
  assert.ok(text.includes("寝返り・立ち上がりは自立。起き上がりは一部介助。"));

  const koi = run({ koi_ue: "自立", koi_shita: "自立", koi_kutsu: "全介助" }).text;
  assert.ok(koi.includes("上衣・下衣は自立。靴下・靴は全介助。"));
});

test("排泄：尿意・便意、昼と夜が同じなら1文、違えば2文", () => {
  assert.ok(run({ haisetsu_nyoui: "ある", haisetsu_beni: "ある" }).text.includes("尿意・便意あり。"));
  assert.ok(run({ haisetsu_nyoui: "ある", haisetsu_beni: "あいまい" }).text.includes("尿意あり。便意はあいまい。"));

  const same = run({
    haisetsu_basho_hiru: "トイレ",
    haisetsu_basho_yoru: "トイレ",
    haisetsu_mono_hiru: ["リハビリパンツ", "尿とりパッド"],
    haisetsu_mono_yoru: ["尿とりパッド", "リハビリパンツ"],
  }).text;
  assert.ok(same.includes("日中・夜間ともトイレ。"));
  assert.ok(same.includes("日中・夜間とも尿とりパッド・リハビリパンツを使用。"));

  const diff = run({ haisetsu_basho_hiru: "トイレ", haisetsu_basho_yoru: "ポータブルトイレ" }).text;
  assert.ok(diff.includes("日中はトイレ。夜間はポータブルトイレ。"));
  assert.ok(run({ haisetsu_shikkin: "ときどきある（尿）" }).text.includes("尿失禁がときどきある。"));
  assert.ok(run({ haisetsu_toilet: ["手すり", "洋式トイレ"] }).text.includes("トイレは洋式で手すりを使用。"));
});

test("入浴：場所と回数を1文にまとめる。片方だけなら残りは未確認", () => {
  assert.ok(run({ nyuyoku_basho: "通所サービス", nyuyoku_kaisu: "週2回" }).text.includes("通所サービスで週2回入浴。"));
  const onlyPlace = run({ nyuyoku_basho: "自宅の浴槽" });
  assert.ok(onlyPlace.text.includes("自宅の浴槽で入浴。【回数：未確認】"));
  assert.ok(onlyPlace.unconfirmedIds.includes("nyuyoku_kaisu"));
  assert.ok(!onlyPlace.unconfirmedIds.includes("nyuyoku_basho"));
  assert.ok(run({ nyuyoku_kaisu: "週1回" }).text.includes("【入浴の場所：未確認】入浴は週1回。"));
});

test("複数選択：「・」でつなぎ、「特になし」は他と一緒なら外す", () => {
  assert.ok(run({ fuku_kufu: ["お薬カレンダー", "一包化"] }).text.includes("一包化・お薬カレンダーを使用。"));
  assert.ok(run({ kihon_bed: ["特になし"] }).text.includes("ベッド周りで使うものは特になし。"));
  const both = run({ kihon_bed: ["特になし", "手すり（ベッド用）"] }).text;
  assert.ok(both.includes("ベッド周りは手すり（ベッド用）を使用。"));
  assert.ok(!both.includes("特になし"));
});

test("訪問時に見られたこと：見た様子と聞いた話で文を分ける", () => {
  const { text } = run({
    ninchi_houmon: ["同じ話を繰り返す", "置き忘れ・しまい忘れがあると聞いた", "日付・曜日を答えられなかった"],
  });
  assert.ok(
    text.includes("訪問時、同じ話を繰り返す様子があり、日付・曜日を答えられなかった。置き忘れ・しまい忘れがあると聞く。"),
  );
  assert.ok(run({ ninchi_houmon: ["同じ話を繰り返す"] }).text.includes("訪問時、同じ話を繰り返す様子あり。"));
});

test("服薬なし：関連項目は未確認に数えない", () => {
  const r = run({ fuku_kanri: "服薬なし" });
  assert.ok(r.text.includes("服薬なし。"));
  for (const label of ["飲む動作", "工夫しているもの", "飲み忘れ"]) {
    assert.ok(!r.unconfirmedItems.includes(label), label);
    assert.ok(!r.text.includes(`【${label}：未確認】`), label);
  }
  assert.equal(r.unconfirmedCount, REQUIRED.length - 4);
  // 通院は服薬なしでも聞く
  assert.ok(r.unconfirmedItems.includes("通院"));
});

test("経管栄養：食べ方に関する項目は未確認に数えない", () => {
  const r = run({ shokuji_dosa: "経管栄養（胃ろう・経鼻等）" });
  assert.ok(r.text.includes("栄養は経管栄養（胃ろう・経鼻等）。"));
  const skipped = ["shokuji_dougu", "shokuji_shushoku", "shokuji_okazu", "shokuji_toromi", "shokuji_muse", "shokuji_ryo", "shokuji_kaisu"];
  // 「回数」は入浴にもあるので、食事・水分のセクションだけを見る
  const shokuji = splitSections(r.text).find((s) => s.title === "食事・水分")!.body;
  for (const id of skipped) {
    const label = ITEMS.find((i) => i.id === id)!.label;
    assert.ok(!r.unconfirmedIds.includes(id), id);
    assert.ok(!shokuji.includes(`【${label}：未確認】`), label);
  }
  // 1つ減った食べる動作の分と、数えない7項目の分だけ減る
  assert.equal(r.unconfirmedCount, REQUIRED.length - 1 - skipped.length);
  // 食事の準備と水分の量は経管栄養でも聞く
  assert.ok(r.unconfirmedIds.includes("shokuji_junbi"));
  assert.ok(r.unconfirmedIds.includes("shokuji_suibun"));
  // 経管栄養の前に選んでいた内容は文に出さない
  const before = run({ shokuji_dosa: "経管栄養（胃ろう・経鼻等）", shokuji_shushoku: "全粥" }).text;
  assert.ok(!before.includes("全粥"));
});

test("備考：各セクションの最後にそのまま付く。空なら何も付かない", () => {
  const { text, unconfirmedCount } = run(
    { kihon_negaeri: "自立", ido_in_tool: "杖（T字）", ido_in_level: "自立" },
    [],
    false,
    { kihon: "  夜間は柵につかまって起きる。\n\n朝はふらつきあり。 ", ido: "", ninchi: "" },
  );
  assert.deepEqual(splitSections(text), [
    { title: "基本動作", body: "寝返りは自立。\n夜間は柵につかまって起きる。\n朝はふらつきあり。" },
    { title: "移動", body: "屋内は杖（T字）で自立。" },
  ]);
  // 備考は未確認の件数に関係しない
  assert.equal(unconfirmedCount, run({ kihon_negaeri: "自立", ido_in_tool: "杖（T字）", ido_in_level: "自立" }, [], false).unconfirmedCount);

  // 何も選んでいないセクションでも、備考だけで出る
  assert.equal(run({}, [], false, { ninchi: "長女より聞き取り。" }).text, "【コミュニケーション・認知】\n長女より聞き取り。");
  // 未確認も出す設定なら、未確認の後ろに付く
  assert.ok(run({}, [], true, { kihon: "備考です" }).text.includes("【使っている寝具：未確認】【ベッド周りで使っているもの：未確認】\n備考です\n\n【移動】"));
  // 備考を書いていなければ、備考なしと同じ文章
  assert.equal(run({ kihon_negaeri: "自立" }, [], true, {}).text, run({ kihon_negaeri: "自立" }, [], true, { kihon: " \n " }).text);
  assert.equal(SECTIONS.length, 10);
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
  // 入浴の場所と回数もすべての組み合わせ
  const places = ITEMS.find((i) => i.id === "nyuyoku_basho")!.choices;
  const counts = ITEMS.find((i) => i.id === "nyuyoku_kaisu")!.choices;
  for (const p of places) for (const k of counts) {
    texts.push(run({ nyuyoku_basho: p.value, nyuyoku_kaisu: k.value }).text);
  }

  for (const text of texts) {
    assert.ok(!text.includes("undefined"), text);
    for (const w of BANNED) assert.ok(!text.includes(w), `「${w}」が含まれている: ${text}`);
  }
});

test("セクションごとに分ける：見出しを除いた本文を、介護ソフトの欄ごとに貼れる形で返す", () => {
  const { text } = run({ kihon_negaeri: "自立", ido_in_tool: "杖（T字）", ido_in_level: "自立" }, [], false);
  assert.deepEqual(splitSections(text), [
    { title: "基本動作", body: "寝返りは自立。" },
    { title: "移動", body: "屋内は杖（T字）で自立。" },
  ]);
  // 未確認も出す設定なら、全10セクションに分かれる
  assert.equal(splitSections(run({}).text).length, 10);
  assert.deepEqual(splitSections(""), []);
});
