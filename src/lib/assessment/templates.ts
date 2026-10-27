/* =====================================================================
 *  選択式アセスメント 項目・選択肢・文章テンプレート
 * ---------------------------------------------------------------------
 *  ★このファイルは純データです。DOM も外部依存も AI 呼び出しもありません。
 *    文章の組み立ては build.ts が行います。
 *
 *  文章のルール:
 *    ・文末は「である」調。介助の程度は「自立／見守り／一部介助／全介助」で書く。
 *    ・聞き取った内容の文末は「と聞き取った」。
 *    ・判断の言葉（「リスクが高い」「〜と思われる」「認知症の進行」など）は書かない。
 *      観察した事実・聞き取った事実だけ。
 *
 *  選択肢の書き方:
 *    value … 画面に出す選択肢（DB にもこの値で保存する）
 *    say   … 文に入れるときの言い方（省略時は value のまま）
 *    full  … この選択肢を選んだときだけ、文全体をこれに置き換える
 *    none  … 「特になし」。他の選択肢と一緒に選ばれたら無視する
 *  value に「家族」を含む選択肢は、登録された続柄（長女・夫など）に置き換えて選べる。
 *
 *  文言を変えたら TEMPLATE_VERSION を上げること（保存済みの文章と区別するため）。
 * ===================================================================== */

/** 文章テンプレートの版。DB の template_version に保存する */
export const TEMPLATE_VERSION = 1;

/** 項目ID → 選んだ値（複数可の項目は配列、自由入力は文字列） */
export type Selections = Record<string, string | string[]>;

export type Choice = {
  value: string;
  say?: string;
  full?: string;
  none?: boolean;
  /** 次の文につなぐときの形（「訪問時に見られたこと」用） */
  link?: string;
  /** 本人の様子（seen）か、聞いた話（heard）か（「訪問時に見られたこと」用） */
  kind?: "seen" | "heard";
  /** 移動用：「〜使用で自立している」の「〜使用で」 */
  means?: string;
  /** 移動用：「〜を使用し、手引きで移動している」の「〜を使用し、」 */
  use?: string;
  /** 移動用：介助の程度が未選択のときの文「〜を使用している」 */
  alone?: string;
  /** 移動用：介助の程度「手引き」 */
  tebiki?: boolean;
};

export type SectionId =
  | "kihon"
  | "ido"
  | "shokuji"
  | "koku"
  | "haisetsu"
  | "nyuyoku"
  | "koi"
  | "fukuyaku"
  | "kaji"
  | "ninchi";

export type Item = {
  id: string;
  /** 項目名。未確認のときは【項目名：未確認】と出る */
  label: string;
  section: SectionId;
  type: "single" | "multi" | "text";
  choices: Choice[];
  /** 任意項目（未確認に数えない） */
  optional?: boolean;
  /** 「〇〇は△△。」の〇〇。MERGE_GROUPS で同じ値の項目を1文にまとめるのに使う */
  subject?: string;
  /** s = 選んだ言い方（複数選択は「・」でつないだもの）から文を作る */
  sentence?: (s: string) => string;
  /** 文全体を独自に組み立てる項目 */
  render?: (picked: Choice[]) => string;
  /** true のとき、この項目は出さず未確認にも数えない */
  skipIf?: (sel: Selections) => boolean;
  /** 自由入力の例 */
  example?: string;
};

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: "kihon", title: "基本動作" },
  { id: "ido", title: "移動" },
  { id: "shokuji", title: "食事・水分" },
  { id: "koku", title: "口腔" },
  { id: "haisetsu", title: "排泄" },
  { id: "nyuyoku", title: "入浴" },
  { id: "koi", title: "更衣・整容" },
  { id: "fukuyaku", title: "服薬" },
  { id: "kaji", title: "家事・生活管理" },
  { id: "ninchi", title: "コミュニケーション・認知" },
];

/* ---------- 選択肢を作る小さな道具 ---------- */

const c = (value: string, say?: string): Choice => (say === undefined ? { value } : { value, say });
const full = (value: string, sentence: string): Choice => ({ value, full: sentence });
const none = (sentence: string): Choice => ({ value: "特になし", none: true, full: sentence });

/** 介助の程度の文末：自立→している／見守り→が必要である／それ以外→である */
const lv = (value: string): Choice => {
  if (value.endsWith("自立")) return c(value, `${value}している`);
  if (value.startsWith("見守り")) return c(value, `${value}が必要である`);
  return c(value, `${value}である`);
};

/** 移動で使うもの */
const tool = (value: string, o: Partial<Choice> = {}): Choice => ({
  value,
  means: `${value}使用で`,
  use: `${value}を使用し、`,
  alone: `${value}を使用している`,
  ...o,
});

const LEVEL5 = ["自立", "つかまって自立", "見守り", "一部介助", "全介助"].map(lv);

const MOVE_TOOLS: Choice[] = [
  tool("なし", { means: "補助具なしで", use: "", alone: "補助具を使用していない" }),
  tool("伝い歩き（家具・壁）", {
    means: "伝い歩き（家具・壁）で",
    use: "伝い歩き（家具・壁）と",
    alone: "伝い歩き（家具・壁）で行っている",
  }),
  tool("手すり"),
  tool("杖（T字）"),
  tool("杖（多点）"),
  tool("歩行器（固定型）"),
  tool("歩行車（キャスター付き）"),
  tool("シルバーカー"),
  tool("車いす（自走）"),
  tool("車いす（介助）"),
  tool("這って移動", { means: "這う方法で", use: "這う方法と", alone: "這う方法で行っている" }),
];

const MOVE_LEVELS: Choice[] = [
  c("自立", "自立している"),
  c("見守り", "見守りが必要である"),
  { value: "手引き", tebiki: true },
  c("一部介助", "一部介助である"),
  c("全介助", "全介助である"),
];

const OUTDOOR_NONE = "屋外へは出ない";

/* ---------- 項目 ---------- */

export const ITEMS: Item[] = [
  /* ===== 基本動作 ===== */
  { id: "kihon_negaeri", label: "寝返り", section: "kihon", type: "single", subject: "寝返り", choices: LEVEL5 },
  { id: "kihon_okiagari", label: "起き上がり", section: "kihon", type: "single", subject: "起き上がり", choices: LEVEL5 },
  {
    id: "kihon_zai",
    label: "座位保持",
    section: "kihon",
    type: "single",
    sentence: (s) => `座位は${s}。`,
    choices: [
      c("支えなしで保てる"),
      c("背もたれや手すりがあれば保てる"),
      c("支えがあっても不安定", "支えがあっても不安定である"),
      c("保てない"),
    ],
  },
  { id: "kihon_tachiagari", label: "立ち上がり", section: "kihon", type: "single", subject: "立ち上がり", choices: LEVEL5 },
  {
    id: "kihon_ritsui",
    label: "立位保持",
    section: "kihon",
    type: "single",
    sentence: (s) => `立位は${s}。`,
    choices: [c("支えなしで保てる"), c("つかまれば保てる"), c("介助があれば短時間保てる"), c("保てない")],
  },
  {
    id: "kihon_shingu",
    label: "使っている寝具",
    section: "kihon",
    type: "single",
    sentence: (s) => `寝具は${s}を使用している。`,
    choices: [c("ベッド（介護用）", "介護用ベッド"), c("ベッド（一般）", "一般のベッド"), c("布団")],
  },
  {
    id: "kihon_bed",
    label: "ベッド周りで使っているもの",
    section: "kihon",
    type: "multi",
    sentence: (s) => `ベッド周りでは${s}を使用している。`,
    choices: [
      c("手すり（ベッド用）"),
      c("手すり（据え置き型）"),
      c("電動の背上げ・高さ調整", "電動の背上げ・高さ調整機能"),
      none("ベッド周りで使用しているものは特にない。"),
    ],
  },

  /* ===== 移動 =====
   * 屋内・屋外の4項目は build.ts の専用処理で文にする（屋内外が同じなら1文）。 */
  { id: "ido_in_tool", label: "屋内で使うもの", section: "ido", type: "single", choices: MOVE_TOOLS },
  { id: "ido_in_level", label: "屋内の介助の程度", section: "ido", type: "single", choices: MOVE_LEVELS },
  {
    id: "ido_out_tool",
    label: "屋外で使うもの",
    section: "ido",
    type: "single",
    choices: [...MOVE_TOOLS, tool("電動車いす・電動カート"), full(OUTDOOR_NONE, "屋外へは出ていない。")],
  },
  {
    id: "ido_out_level",
    label: "屋外の介助の程度",
    section: "ido",
    type: "single",
    choices: MOVE_LEVELS,
    skipIf: (sel) => sel.ido_out_tool === OUTDOOR_NONE,
  },
  {
    id: "ido_gaishutsu",
    label: "外出の機会",
    section: "ido",
    type: "single",
    sentence: (s) => `外出は${s}。`,
    choices: [
      c("ほぼ毎日", "ほぼ毎日である"),
      c("週に数回", "週に数回である"),
      c("週1回程度", "週1回程度である"),
      c("月に数回", "月に数回である"),
      c("通院のみ", "通院のみである"),
      c("ほとんどない"),
    ],
  },
  {
    id: "ido_shudan",
    label: "外出の手段",
    section: "ido",
    type: "multi",
    sentence: (s) => `外出の手段は${s}である。`,
    choices: [
      c("徒歩"),
      c("自転車"),
      c("自分で運転", "本人の運転"),
      c("家族の送迎"),
      c("タクシー"),
      c("バス・電車"),
      c("通所サービスの送迎"),
    ],
  },
  {
    id: "ido_tento",
    label: "転倒",
    section: "ido",
    type: "single",
    sentence: (s) => `転倒は${s}と聞き取った。`,
    choices: [
      c("直近1年でなし", "直近1年でなかった"),
      c("直近1年で1回", "直近1年で1回あった"),
      c("直近1年で複数回", "直近1年で複数回あった"),
      full("最近転びそうになることがある", "最近転びそうになることがあると聞き取った。"),
    ],
  },
  {
    id: "ido_tento_basho",
    label: "転倒した場所",
    section: "ido",
    type: "multi",
    optional: true,
    sentence: (s) => `転倒した場所は${s}である。`,
    choices: [c("屋内"), c("屋外"), c("トイレ"), c("浴室"), c("玄関・段差"), c("寝室")],
  },

  /* ===== 食事・水分 ===== */
  {
    id: "shokuji_dosa",
    label: "食べる動作",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事摂取は${s}。`,
    choices: [
      lv("自立"),
      c("準備（切る・開ける等）があれば自立", "準備があれば自立している"),
      lv("見守り"),
      lv("一部介助"),
      lv("全介助"),
    ],
  },
  {
    id: "shokuji_dougu",
    label: "食事で使う道具",
    section: "shokuji",
    type: "multi",
    sentence: (s) => `食事では${s}を使用している。`,
    choices: [
      c("箸"),
      c("スプーン・フォーク"),
      c("自助具（太柄・曲がりスプーン等）"),
      c("とろみ用のコップ・吸い飲み"),
      c("エプロン"),
    ],
  },
  {
    id: "shokuji_shushoku",
    label: "主食の形",
    section: "shokuji",
    type: "single",
    sentence: (s) => `主食は${s}である。`,
    choices: [c("普通（ご飯）", "普通のご飯"), c("軟飯"), c("全粥"), c("パン中心")],
  },
  {
    id: "shokuji_okazu",
    label: "おかずの形",
    section: "shokuji",
    type: "single",
    sentence: (s) => `おかずは${s}である。`,
    choices: [c("普通", "普通の形"), c("一口大"), c("きざみ"), c("ソフト食・ムース"), c("ミキサー", "ミキサー食")],
  },
  {
    id: "shokuji_toromi",
    label: "水分のとろみ",
    section: "shokuji",
    type: "single",
    sentence: (s) => `水分は${s}で摂っている。`,
    choices: [
      c("なし", "とろみなし"),
      c("あり（薄め）", "とろみあり（薄め）"),
      c("あり（中間）", "とろみあり（中間）"),
      c("あり（濃いめ）", "とろみあり（濃いめ）"),
    ],
  },
  {
    id: "shokuji_muse",
    label: "むせ",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事中のむせは${s}と聞き取った。`,
    choices: [c("ほとんどない"), c("ときどきある"), c("よくある")],
  },
  {
    id: "shokuji_ryo",
    label: "食事の量",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事量は${s}と聞き取った。`,
    choices: [c("ほぼ全量"), c("半分程度"), c("半分未満"), c("日によって差がある")],
  },
  {
    id: "shokuji_kaisu",
    label: "食事の回数",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事は${s}である。`,
    choices: [c("1日3食"), c("1日2食"), c("不規則")],
  },
  {
    id: "shokuji_junbi",
    label: "食事の準備",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事は主に${s}。`,
    choices: [
      c("本人が作る", "本人が作っている"),
      c("家族が作る", "家族が作っている"),
      c("配食サービス", "配食サービスを利用している"),
      c("ヘルパー", "ヘルパーが作っている"),
      c("買ってきたもの中心", "買ってきたものを食べている"),
    ],
  },
  {
    id: "shokuji_suibun",
    label: "水分の量",
    section: "shokuji",
    type: "text",
    example: "コップ5杯程度",
    sentence: (s) => `水分は${s}と聞き取った。`,
    choices: [],
  },

  /* ===== 口腔 ===== */
  {
    id: "koku_ha",
    label: "歯の状態",
    section: "koku",
    type: "single",
    sentence: (s) => `${s}。`,
    choices: [
      c("自分の歯が多い", "自分の歯が多い"),
      c("部分入れ歯", "部分入れ歯を使用している"),
      c("総入れ歯", "総入れ歯を使用している"),
      c("歯がほとんどなく入れ歯なし", "歯がほとんどなく、入れ歯は使用していない"),
    ],
  },
  {
    id: "koku_ireba",
    label: "入れ歯の合い具合",
    section: "koku",
    type: "single",
    optional: true,
    sentence: (s) => `入れ歯は${s}。`,
    choices: [c("合っている", "合っていると聞き取った"), c("合わない・痛いと話している"), c("外していることが多い")],
  },
  {
    id: "koku_care",
    label: "歯みがき・入れ歯の手入れ",
    section: "koku",
    type: "single",
    sentence: (s) => `口腔ケアは${s}。`,
    choices: [
      lv("自立"),
      c("声かけで実施", "声かけで実施している"),
      c("仕上げのみ介助", "仕上げのみ介助を受けている"),
      lv("全介助"),
      c("行えていない"),
    ],
  },
  {
    id: "koku_shika",
    label: "歯科の受診",
    section: "koku",
    type: "single",
    sentence: (s) => `歯科は${s}。`,
    choices: [
      c("定期的に受診", "定期的に受診している"),
      c("困ったときのみ", "困ったときのみ受診している"),
      c("受診していない"),
      c("訪問歯科を利用", "訪問歯科を利用している"),
    ],
  },
  {
    id: "koku_kininaru",
    label: "口腔で気になること",
    section: "koku",
    type: "multi",
    optional: true,
    sentence: (s) => `口腔について、${s}との訴えがある。`,
    choices: [c("口の乾き"), c("食べこぼし"), c("口臭"), c("噛みにくい"), c("飲み込みにくい")],
  },

  /* ===== 排泄 =====
   * 場所・使うものは昼と夜が同じなら1文（PAIRS）。 */
  {
    id: "haisetsu_nyoui",
    label: "尿意",
    section: "haisetsu",
    type: "single",
    subject: "尿意",
    choices: [c("ある"), c("あいまい", "あいまいである"), c("ない")],
  },
  {
    id: "haisetsu_beni",
    label: "便意",
    section: "haisetsu",
    type: "single",
    subject: "便意",
    choices: [c("ある"), c("あいまい", "あいまいである"), c("ない")],
  },
  ...(["昼", "夜"] as const).map(
    (t): Item => ({
      id: t === "昼" ? "haisetsu_basho_hiru" : "haisetsu_basho_yoru",
      label: `排泄の場所（${t}）`,
      section: "haisetsu",
      type: "single",
      sentence: (s) => `${t === "昼" ? "日中" : "夜間"}は${s}。`,
      choices: [
        c("トイレ", "トイレで排泄している"),
        c("ポータブルトイレ", "ポータブルトイレを使用している"),
        c("尿器・便器", "尿器・便器を使用している"),
        c("おむつ内", "おむつ内に排泄している"),
      ],
    }),
  ),
  ...(["昼", "夜"] as const).map(
    (t): Item => ({
      id: t === "昼" ? "haisetsu_mono_hiru" : "haisetsu_mono_yoru",
      label: `排泄で使っているもの（${t}）`,
      section: "haisetsu",
      type: "multi",
      sentence: (s) => `${t === "昼" ? "日中" : "夜間"}は${s}を使用している。`,
      choices: [c("布の下着"), c("尿とりパッド"), c("リハビリパンツ"), c("テープ式おむつ")],
    }),
  ),
  {
    id: "haisetsu_dosa",
    label: "排泄動作の介助",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `排泄動作は${s}。`,
    choices: [lv("自立"), lv("見守り"), lv("一部介助（拭く・衣類の上げ下げ等）"), lv("全介助")],
  },
  {
    id: "haisetsu_shikkin",
    label: "失禁",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `失禁は${s}と聞き取った。`,
    choices: [c("ない"), c("ときどきある（尿）"), c("ときどきある（便）"), c("毎日ある")],
  },
  {
    id: "haisetsu_yakan",
    label: "夜間のトイレの回数",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `夜間のトイレは${s}と聞き取った。`,
    choices: [c("0回"), c("1〜2回"), c("3回以上")],
  },
  {
    id: "haisetsu_bentsu",
    label: "便通",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `便通は${s}と聞き取った。`,
    choices: [
      c("毎日", "毎日ある"),
      c("2〜3日に1回", "2〜3日に1回である"),
      c("それ以上あく", "3日より間があく"),
      full("下剤を使っている", "下剤を使用していると聞き取った。"),
    ],
  },
  {
    id: "haisetsu_toilet",
    label: "トイレ周りで使っているもの",
    section: "haisetsu",
    type: "multi",
    choices: [c("手すり"), c("補高便座"), c("洋式トイレ", "洋式"), c("和式トイレ", "和式")],
    render: (picked) => {
      const say = (p: Choice) => p.say ?? p.value;
      const kind = picked.filter((p) => p.value.endsWith("式トイレ")).map(say).join("・");
      const equip = picked.filter((p) => !p.value.endsWith("式トイレ")).map(say).join("・");
      if (kind && equip) return `トイレは${kind}で、${equip}を使用している。`;
      if (kind) return `トイレは${kind}である。`;
      return `トイレでは${equip}を使用している。`;
    },
  },

  /* ===== 入浴 ===== */
  {
    id: "nyuyoku_basho",
    label: "入浴の場所",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴は${s}。`,
    choices: [
      c("自宅の浴槽", "自宅の浴槽で行っている"),
      c("自宅のシャワーのみ", "自宅でシャワー浴のみ行っている"),
      c("通所サービス", "通所サービスで行っている"),
      c("訪問入浴", "訪問入浴を利用している"),
      c("清拭のみ", "行っておらず、清拭のみである"),
    ],
  },
  {
    id: "nyuyoku_kaisu",
    label: "入浴の回数",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴は${s}である。`,
    choices: [c("週3回以上"), c("週2回"), c("週1回"), c("それ未満", "週1回未満")],
  },
  {
    id: "nyuyoku_level",
    label: "入浴の介助の程度",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴は${s}。`,
    choices: [lv("自立"), lv("見守り"), lv("一部介助"), lv("全介助")],
  },
  {
    id: "nyuyoku_bubun",
    label: "入浴で介助が必要な部分",
    section: "nyuyoku",
    type: "multi",
    optional: true,
    sentence: (s) => `${s}に介助を受けている。`,
    choices: [c("浴槽の出入り"), c("洗身（背中・足先）"), c("洗髪"), c("脱衣場の移動"), c("着替え")],
  },
  {
    id: "nyuyoku_mono",
    label: "浴室で使っているもの",
    section: "nyuyoku",
    type: "multi",
    sentence: (s) => `浴室では${s}を使用している。`,
    choices: [
      c("手すり"),
      c("シャワーチェア"),
      c("浴槽台"),
      c("バスボード"),
      c("すべり止めマット"),
      none("浴室で使用しているものは特にない。"),
    ],
  },
  {
    id: "nyuyoku_ikou",
    label: "入浴についての本人の意向",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴について、${s}。`,
    choices: [
      c("入りたがっている", "入りたがっている様子がみられた"),
      c("気が進まない様子", "気が進まない様子がみられた"),
      c("特に話はない", "本人から特に話はなかった"),
    ],
  },

  /* ===== 更衣・整容 ===== */
  ...([
    ["koi_ue", "上衣の着脱", "上衣"],
    ["koi_shita", "下衣の着脱", "下衣"],
    ["koi_kutsu", "靴下・靴", "靴下・靴"],
  ] as const).map(
    ([id, label, subject]): Item => ({
      id,
      label,
      section: "koi",
      type: "single",
      subject,
      choices: [lv("自立"), lv("時間はかかるが自立"), lv("見守り・声かけ"), lv("一部介助"), lv("全介助")],
    }),
  ),
  {
    id: "koi_erabu",
    label: "服を選ぶ",
    section: "koi",
    type: "single",
    sentence: (s) => `衣類は${s}。`,
    choices: [c("季節に合わせて選べている"), c("声かけがあれば選べている"), c("家族が用意している")],
  },
  ...([
    ["seiyo_sengan", "洗顔"],
    ["seiyo_seihatsu", "整髪・ひげそり"],
  ] as const).map(
    ([id, label]): Item => ({
      id,
      label,
      section: "koi",
      type: "single",
      subject: label,
      choices: [lv("自立"), c("声かけで実施", "声かけで実施している"), lv("一部介助"), lv("全介助")],
    }),
  ),
  {
    id: "seiyo_tsume",
    label: "爪切り",
    section: "koi",
    type: "single",
    sentence: (s) => `爪切りは${s}。`,
    choices: [c("本人が行っている"), c("家族が行っている"), c("サービスで行っている"), c("行えていない")],
  },

  /* ===== 服薬 =====
   * 薬の名前や量は扱わない。「服薬なし」なら飲む動作・工夫・飲み忘れ・残薬は出さない。 */
  {
    id: "fuku_kanri",
    label: "薬の管理",
    section: "fukuyaku",
    type: "single",
    sentence: (s) => `${s}。`,
    choices: [
      c("本人が管理", "薬は本人が管理している"),
      c("家族が管理", "薬は家族が管理している"),
      c("訪問看護が管理", "薬は訪問看護が管理している"),
      c("薬剤師（居宅療養管理指導）が関わっている", "薬の管理には薬剤師（居宅療養管理指導）が関わっている"),
      c("服薬なし", "現在、服薬はしていない"),
    ],
  },
  ...(
    [
      {
        id: "fuku_dosa",
        label: "薬を飲む動作",
        section: "fukuyaku",
        type: "single",
        sentence: (s) => `服薬は${s}。`,
        choices: [c("自分で飲んでいる"), c("手渡しすれば飲んでいる"), c("口まで運ぶ介助が必要", "口まで運ぶ介助が必要である")],
      },
      {
        id: "fuku_kufu",
        label: "服薬で工夫しているもの",
        section: "fukuyaku",
        type: "multi",
        sentence: (s) => `服薬では${s}を使用している。`,
        choices: [
          c("一包化"),
          c("お薬カレンダー"),
          c("服薬ボックス"),
          c("服薬支援の機器"),
          none("服薬で工夫して使用しているものは特にない。"),
        ],
      },
      {
        id: "fuku_wasure",
        label: "飲み忘れ",
        section: "fukuyaku",
        type: "single",
        sentence: (s) => `飲み忘れは${s}と聞き取った。`,
        choices: [
          c("ほとんどない"),
          c("ときどきある"),
          c("多い"),
          full("確認できていない", "飲み忘れの有無は確認できていない。"),
        ],
      },
      {
        id: "fuku_zanyaku",
        label: "訪問時の残薬",
        section: "fukuyaku",
        type: "single",
        optional: true,
        sentence: (s) => `訪問時に残薬が${s}。`,
        choices: [c("あった"), c("なかった")],
      },
    ] satisfies Item[]
  ).map((item): Item => ({ ...item, skipIf: (sel) => sel.fuku_kanri === "服薬なし" })),
  {
    id: "fuku_tsuin",
    label: "通院",
    section: "fukuyaku",
    type: "single",
    sentence: (s) => `${s}。`,
    choices: [
      c("定期的に受診している", "医療機関を定期的に受診している"),
      c("訪問診療", "訪問診療を受けている"),
      c("受診が途切れている", "医療機関の受診が途切れている"),
    ],
  },
  {
    id: "fuku_tsukisoi",
    label: "通院の付き添い",
    section: "fukuyaku",
    type: "single",
    sentence: (s) => `${s}。`,
    choices: [
      c("なし（本人のみ）", "通院は本人のみで行っている"),
      c("家族", "通院には家族が付き添っている"),
      c("サービス（通院等乗降介助等）", "通院にはサービス（通院等乗降介助等）を利用している"),
    ],
  },

  /* ===== 家事・生活管理 =====
   * 家事は「誰がしているか」。同じ人がしている家事は1文にまとめる（MERGE_GROUPS）。 */
  {
    id: "kaji_chori",
    label: "調理",
    section: "kaji",
    type: "single",
    subject: "調理",
    choices: [
      c("本人", "本人が行っている"),
      c("本人（簡単なものだけ）", "本人が簡単なものだけ行っている"),
      c("家族", "家族が行っている"),
      c("ヘルパー", "ヘルパーが行っている"),
      c("配食・購入で対応", "配食・購入で対応している"),
      c("家族とヘルパーで分担", "家族とヘルパーで分担している"),
    ],
  },
  ...([
    ["kaji_soji", "掃除"],
    ["kaji_sentaku", "洗濯"],
  ] as const).map(
    ([id, label]): Item => ({
      id,
      label,
      section: "kaji",
      type: "single",
      subject: label,
      choices: [
        c("本人", "本人が行っている"),
        c("家族", "家族が行っている"),
        c("ヘルパー", "ヘルパーが行っている"),
        c("家族とヘルパーで分担", "家族とヘルパーで分担している"),
        c("行えていない"),
      ],
    }),
  ),
  {
    id: "kaji_kaimono",
    label: "買い物",
    section: "kaji",
    type: "single",
    subject: "買い物",
    choices: [
      c("本人", "本人が行っている"),
      c("家族", "家族が行っている"),
      c("ヘルパー", "ヘルパーが行っている"),
      c("宅配・ネットスーパー", "宅配・ネットスーパーを利用している"),
      c("移動販売", "移動販売を利用している"),
    ],
  },
  {
    id: "kaji_gomi",
    label: "ゴミ出し",
    section: "kaji",
    type: "single",
    subject: "ゴミ出し",
    choices: [
      c("本人", "本人が行っている"),
      c("家族", "家族が行っている"),
      c("ヘルパー", "ヘルパーが行っている"),
      c("近所の人", "近所の人が行っている"),
    ],
  },
  {
    id: "kaji_okane",
    label: "お金の管理",
    section: "kaji",
    type: "single",
    sentence: (s) => `金銭管理は${s}。`,
    choices: [
      c("本人", "本人が行っている"),
      c("本人（家族が確認）", "本人が行い、家族が確認している"),
      c("家族", "家族が行っている"),
      c("成年後見人等", "成年後見人等が行っている"),
      c("日常生活自立支援事業", "日常生活自立支援事業を利用している"),
    ],
  },
  {
    id: "kaji_shorui",
    label: "書類・郵便物の管理",
    section: "kaji",
    type: "single",
    sentence: (s) => `書類・郵便物は${s}。`,
    choices: [
      c("本人", "本人が管理している"),
      c("家族", "家族が管理している"),
      c("溜まっている様子", "溜まっている様子がみられた"),
    ],
  },
  {
    id: "kaji_denwa",
    label: "電話の使用",
    section: "kaji",
    type: "single",
    sentence: (s) => `電話は${s}。`,
    choices: [c("自分でかけられる"), c("受けるだけ", "受けるだけである"), c("使っていない")],
  },

  /* ===== コミュニケーション・認知 =====
   * 評価の言葉は出さない。見聞きしたことだけ。 */
  {
    id: "ninchi_shiryoku",
    label: "視力",
    section: "ninchi",
    type: "single",
    sentence: (s) => `視力は${s}。`,
    choices: [
      c("日常生活に支障なし", "日常生活に支障がない"),
      c("眼鏡で支障なし", "眼鏡で支障がない"),
      c("大きい字なら読める"),
      c("ほとんど見えない"),
    ],
  },
  {
    id: "ninchi_choryoku",
    label: "聴力",
    section: "ninchi",
    type: "single",
    sentence: (s) => `聴力は${s}。`,
    choices: [
      c("普通の声で聞こえる"),
      c("大きい声なら聞こえる"),
      full("補聴器を使用", "補聴器を使用している。"),
      c("ほとんど聞こえない"),
    ],
  },
  {
    id: "ninchi_kaiwa",
    label: "会話",
    section: "ninchi",
    type: "single",
    sentence: (s) => `会話は${s}。`,
    choices: [
      c("普通に会話できる", "普通にできる"),
      c("簡単な内容なら会話できる", "簡単な内容ならできる"),
      c("身ぶりや表情でのやり取りが中心", "身ぶりや表情でのやり取りが中心である"),
      full("発語が少ない", "発語は少ない。"),
    ],
  },
  {
    id: "ninchi_ishi",
    label: "意思の伝え方",
    section: "ninchi",
    type: "single",
    sentence: (s) => `自分の希望は${s}。`,
    choices: [
      c("自分から伝えられる"),
      c("聞かれれば答えられる"),
      c("伝えることが難しい様子", "伝えることが難しい様子がみられた"),
    ],
  },
  {
    id: "ninchi_houmon",
    label: "訪問時に見られたこと",
    section: "ninchi",
    type: "multi",
    choices: [
      { value: "同じ話を繰り返す", kind: "seen", say: "同じ話を繰り返す様子がみられた", link: "同じ話を繰り返す様子がみられ" },
      { value: "日付・曜日を答えられなかった", kind: "seen", say: "日付・曜日を答えられなかった", link: "日付・曜日を答えられず" },
      { value: "訪問の約束を覚えていなかった", kind: "seen", say: "訪問の約束を覚えていなかった", link: "訪問の約束を覚えておらず" },
      { value: "置き忘れ・しまい忘れがあると聞いた", kind: "heard", say: "置き忘れ・しまい忘れがある", link: "置き忘れ・しまい忘れがあり" },
      { value: "鍋を焦がしたことがあると聞いた", kind: "heard", say: "鍋を焦がしたことがある", link: "鍋を焦がしたことがあり" },
      none("訪問時に見られたことは特にない。"),
    ],
    // 本人の様子（訪問時、〜）と聞いた話（〜と聞き取った）で文を分ける
    render: (picked) => {
      const chain = (ps: Choice[]) =>
        ps.map((p, i) => (i < ps.length - 1 ? p.link : p.say)).join("、");
      const seen = picked.filter((p) => p.kind === "seen");
      const heard = picked.filter((p) => p.kind === "heard");
      return (
        (seen.length ? `訪問時、${chain(seen)}。` : "") + (heard.length ? `${chain(heard)}と聞き取った。` : "")
      );
    },
  },
  {
    id: "ninchi_kitaku",
    label: "一人で外出して帰りに時間がかかることがあるか",
    section: "ninchi",
    type: "single",
    sentence: (s) => `一人で外出し、帰宅に時間を要したことが${s}と聞き取った。`,
    choices: [c("ない"), c("あったと聞いた", "あった")],
  },
  {
    id: "ninchi_kibun",
    label: "気分・意欲（見られた様子）",
    section: "ninchi",
    type: "single",
    sentence: (s) => `訪問時、${s}。`,
    choices: [
      c("変わりない", "気分・意欲について普段と変わった様子はみられなかった"),
      c("口数が少ない", "口数が少ない様子がみられた"),
      c("涙ぐむ場面があった"),
      c("「何もしたくない」等の発言があった"),
    ],
  },
  {
    id: "ninchi_nichu",
    label: "日中の過ごし方",
    section: "ninchi",
    type: "single",
    sentence: (s) => `日中は${s}と聞き取った。`,
    choices: [
      c("起きて過ごしている"),
      c("横になっている時間が長い"),
      c("テレビ中心", "テレビを見て過ごすことが中心である"),
      c("趣味・畑仕事等をしている"),
    ],
  },
];

/**
 * 同じ値を選んだら1文にまとめる項目の組（subject を持つ項目）。
 * 例：寝返り・起き上がりが同じ → 「寝返り・起き上がりは自立している。」
 * suffix は主語の後ろに付く言葉（上衣・下衣 → 「上衣・下衣の着脱は〜」）。
 */
export const MERGE_GROUPS: { ids: string[]; suffix?: string }[] = [
  { ids: ["kihon_negaeri", "kihon_okiagari", "kihon_tachiagari"] },
  { ids: ["haisetsu_nyoui", "haisetsu_beni"] },
  { ids: ["koi_ue", "koi_shita", "koi_kutsu"], suffix: "の着脱" },
  { ids: ["seiyo_sengan", "seiyo_seihatsu"] },
  { ids: ["kaji_chori", "kaji_soji", "kaji_sentaku", "kaji_kaimono", "kaji_gomi"] },
];

/**
 * 昼と夜が同じなら1文にまとめる項目の組。
 * both には同じ言い方 s が渡る。
 */
export const PAIRS: { a: string; b: string; both: (s: string) => string }[] = [
  { a: "haisetsu_basho_hiru", b: "haisetsu_basho_yoru", both: (s) => `日中・夜間とも${s}。` },
  { a: "haisetsu_mono_hiru", b: "haisetsu_mono_yoru", both: (s) => `日中・夜間とも${s}を使用している。` },
];

/** 移動（屋内・屋外）の4項目。build.ts の専用処理で使う */
export const MOVE_IDS = {
  inTool: "ido_in_tool",
  inLevel: "ido_in_level",
  outTool: "ido_out_tool",
  outLevel: "ido_out_level",
} as const;
