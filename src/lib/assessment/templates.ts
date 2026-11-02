/* =====================================================================
 *  選択式アセスメント 項目・選択肢・文章テンプレート
 * ---------------------------------------------------------------------
 *  ★このファイルは純データです。DOM も外部依存も AI 呼び出しもありません。
 *    文章の組み立ては build.ts が行います。
 *
 *  文章のルール（版2）:
 *    ・文は短く言い切る。文末に「〜している」「〜である」は付けない（例：屋内は杖（T字）で自立。）
 *    ・見出しで分かることは繰り返さない（【移動】の中で「移動は」と書かない）
 *    ・介助の程度は「自立／見守り／一部介助／全介助」で書く
 *    ・「と聞く」は認知の項目で、見た様子と聞いた話を分けるときだけ使う
 *    ・判断の言葉（「リスクが高い」「〜と思われる」「認知症の進行」など）は書かない。
 *      観察した事実・聞いた事実だけ。
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
export const TEMPLATE_VERSION = 2;

/** 項目ID → 選んだ値（複数可の項目は配列、自由入力は文字列） */
export type Selections = Record<string, string | string[]>;

export type Choice = {
  value: string;
  say?: string;
  full?: string;
  none?: boolean;
  /** 主語の後ろに「は」を付けない（「尿意あり。」） */
  bare?: boolean;
  /** 次の文につなぐときの形（「訪問時に見られたこと」用） */
  link?: string;
  /** 本人の様子（seen）か、聞いた話（heard）か（「訪問時に見られたこと」用） */
  kind?: "seen" | "heard";
  /** 移動用：「杖（T字）で自立」の「杖（T字）で」 */
  means?: string;
  /** 移動用：「杖（T字）を使用し、手引きで移動」の「杖（T字）を使用し、」 */
  use?: string;
  /** 移動用：介助の程度が未選択のときの「杖（T字）を使用」 */
  alone?: string;
  /** 移動用：介助の程度「手引き」 */
  tebiki?: boolean;
  /** 入浴の場所用：回数（例「週2回」、未選択なら ""）を入れた文 */
  place?: (count: string) => string;
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

/** 備考欄の文字数の上限（セクションごと） */
export const NOTE_MAX = 300;

/** セクションごとの備考（任意。未確認に数えない。外部の AI には送らない） */
export type Notes = Partial<Record<SectionId, string>>;

/* ---------- 選択肢を作る小さな道具 ---------- */

const c = (value: string, say?: string): Choice => (say === undefined ? { value } : { value, say });
const full = (value: string, sentence: string): Choice => ({ value, full: sentence });
const none = (sentence: string): Choice => ({ value: "特になし", none: true, full: sentence });
const bare = (value: string, say: string): Choice => ({ value, say, bare: true });

/** 移動で使うもの */
const tool = (value: string, o: Partial<Choice> = {}): Choice => ({
  value,
  means: `${value}で`,
  use: `${value}を使用し、`,
  alone: `${value}を使用`,
  ...o,
});

const LEVEL4 = ["自立", "見守り", "一部介助", "全介助"].map((v) => c(v));
const LEVEL5 = ["自立", "つかまって自立", "見守り", "一部介助", "全介助"].map((v) => c(v));

const MOVE_TOOLS: Choice[] = [
  tool("なし", { means: "補助具なしで", use: "", alone: "補助具なし" }),
  tool("伝い歩き（家具・壁）", {
    use: "伝い歩き（家具・壁）と",
    alone: "伝い歩き（家具・壁）で移動",
  }),
  tool("手すり"),
  tool("杖（T字）"),
  tool("杖（多点）"),
  tool("歩行器（固定型）"),
  tool("歩行車（キャスター付き）"),
  tool("シルバーカー"),
  tool("車いす（自走）"),
  tool("車いす（介助）"),
  tool("這って移動", { means: "這う方法で", use: "這う方法と", alone: "這って移動" }),
];

const MOVE_LEVELS: Choice[] = [c("自立"), c("見守り"), { value: "手引き", tebiki: true }, c("一部介助"), c("全介助")];

const OUTDOOR_NONE = "屋外へは出ない";
const TUBE_FEEDING = "経管栄養（胃ろう・経鼻等）";
const NO_MEDICINE = "服薬なし";

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
    choices: [c("支えなしで保てる"), c("背もたれや手すりがあれば保てる"), c("支えがあっても不安定"), c("保てない")],
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
    sentence: (s) => `${s}を使用。`,
    choices: [c("ベッド（介護用）", "介護用ベッド"), c("ベッド（一般）", "一般のベッド"), c("布団")],
  },
  {
    id: "kihon_bed",
    label: "ベッド周りで使っているもの",
    section: "kihon",
    type: "multi",
    sentence: (s) => `ベッド周りは${s}を使用。`,
    choices: [
      c("手すり（ベッド用）"),
      c("手すり（据え置き型）"),
      c("電動の背上げ・高さ調整", "電動の背上げ・高さ調整機能"),
      none("ベッド周りで使うものは特になし。"),
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
    choices: [...MOVE_TOOLS, tool("電動車いす・電動カート"), full(OUTDOOR_NONE, "屋外へは出ない。")],
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
    choices: [c("ほぼ毎日"), c("週に数回"), c("週1回程度"), c("月に数回"), c("通院のみ"), c("ほとんどない")],
  },
  {
    id: "ido_shudan",
    label: "外出の手段",
    section: "ido",
    type: "multi",
    sentence: (s) => `外出時は${s}。`,
    choices: [
      c("徒歩"),
      c("自転車"),
      c("自分で運転"),
      c("家族の送迎"),
      c("タクシー"),
      c("バス・電車"),
      c("介護タクシー"),
      c("通所サービスの送迎"),
      c("施設の送迎"),
    ],
  },
  {
    id: "ido_tento",
    label: "転倒",
    section: "ido",
    type: "single",
    sentence: (s) => `${s}転倒あり。`,
    choices: [
      full("直近1年でなし", "直近1年の転倒なし。"),
      c("直近1年で1回"),
      c("直近1年で複数回"),
      full("最近転びそうになることがある", "最近、転びそうになることがある。"),
    ],
  },
  {
    id: "ido_tento_basho",
    label: "転倒した場所",
    section: "ido",
    type: "multi",
    optional: true,
    sentence: (s) => `場所は${s}。`,
    choices: [c("屋内"), c("屋外"), c("トイレ"), c("浴室"), c("玄関・段差"), c("寝室")],
  },

  /* ===== 食事・水分 =====
   * 経管栄養なら、食べ方に関する項目（道具〜回数）は出さず未確認にも数えない。 */
  {
    id: "shokuji_dosa",
    label: "食べる動作",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事は${s}。`,
    choices: [
      c("自立"),
      c("準備（切る・開ける等）があれば自立", "準備があれば自立"),
      c("見守り"),
      c("一部介助"),
      c("全介助"),
      full(TUBE_FEEDING, `栄養は${TUBE_FEEDING}。`),
    ],
  },
  ...(
    [
      {
        id: "shokuji_dougu",
        label: "使う道具",
        section: "shokuji",
        type: "multi",
        sentence: (s) => `${s}を使用。`,
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
        sentence: (s) => `主食は${s}。`,
        choices: [c("普通（ご飯）", "普通のご飯"), c("軟飯"), c("全粥"), c("パン中心")],
      },
      {
        id: "shokuji_okazu",
        label: "おかずの形",
        section: "shokuji",
        type: "single",
        sentence: (s) => `おかずは${s}。`,
        choices: [c("普通", "普通の形"), c("一口大"), c("きざみ"), c("ソフト食・ムース"), c("ミキサー", "ミキサー食")],
      },
      {
        id: "shokuji_toromi",
        label: "水分のとろみ",
        section: "shokuji",
        type: "single",
        sentence: (s) => `水分は${s}。`,
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
        sentence: (s) => `むせが${s}。`,
        choices: [c("ほとんどない"), c("ときどきある"), c("よくある")],
      },
      {
        id: "shokuji_ryo",
        label: "食事の量",
        section: "shokuji",
        type: "single",
        sentence: (s) => `食事量は${s}。`,
        choices: [
          c("ほぼ全量"),
          c("半分程度"),
          c("半分未満"),
          c("日によって差がある"),
          full("食べ過ぎてしまうことがある", "食べ過ぎてしまうことがある。"),
        ],
      },
      {
        id: "shokuji_kaisu",
        label: "回数",
        section: "shokuji",
        type: "single",
        sentence: (s) => `${s}。`,
        choices: [c("1日3食"), c("1日2食"), c("不規則", "食事の時間・回数は不規則")],
      },
    ] satisfies Item[]
  ).map((item): Item => ({ ...item, skipIf: (sel) => sel.shokuji_dosa === TUBE_FEEDING })),
  {
    id: "shokuji_junbi",
    label: "食事の準備",
    section: "shokuji",
    type: "single",
    sentence: (s) => `食事の準備は${s}。`,
    choices: [
      c("本人が作る", "本人"),
      c("家族が作る", "家族"),
      c("配食サービス"),
      c("ヘルパー"),
      c("買ってきたもの中心"),
      c("施設の食事"),
    ],
  },
  {
    id: "shokuji_suibun",
    label: "水分の量",
    section: "shokuji",
    type: "text",
    example: "コップ5杯程度",
    sentence: (s) => `水分は${s}。`,
    choices: [],
  },

  /* ===== 口腔 ===== */
  {
    id: "koku_ha",
    label: "歯の状態",
    section: "koku",
    type: "single",
    sentence: (s) => `${s}を使用。`,
    choices: [
      full("自分の歯が多い", "自分の歯が多い。"),
      c("部分入れ歯"),
      c("総入れ歯"),
      full("歯がほとんどなく入れ歯なし", "歯がほとんどなく、入れ歯なし。"),
    ],
  },
  {
    id: "koku_ireba",
    label: "入れ歯の合い具合",
    section: "koku",
    type: "single",
    optional: true,
    sentence: (s) => `入れ歯が${s}。`,
    choices: [
      full("合っている", "入れ歯は合っている。"),
      c("合わない・痛いと話している", "合わない・痛いと話す"),
      full("外していることが多い", "入れ歯は外していることが多い。"),
    ],
  },
  {
    id: "koku_care",
    label: "歯みがき・入れ歯の手入れ",
    section: "koku",
    type: "single",
    sentence: (s) => `口腔ケアは${s}。`,
    choices: [c("自立"), c("声かけで実施"), c("仕上げのみ介助"), c("全介助"), c("行えていない")],
  },
  {
    id: "koku_shika",
    label: "歯科の受診",
    section: "koku",
    type: "single",
    sentence: (s) => `歯科は${s}。`,
    choices: [
      c("定期的に受診"),
      c("困ったときのみ", "困ったときのみ受診"),
      c("受診していない"),
      full("訪問歯科を利用", "訪問歯科を利用。"),
    ],
  },
  {
    id: "koku_kininaru",
    label: "気になること",
    section: "koku",
    type: "multi",
    optional: true,
    sentence: (s) => `${s}との訴えあり。`,
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
    choices: [bare("ある", "あり"), c("あいまい"), bare("ない", "なし")],
  },
  {
    id: "haisetsu_beni",
    label: "便意",
    section: "haisetsu",
    type: "single",
    subject: "便意",
    choices: [bare("ある", "あり"), c("あいまい"), bare("ない", "なし")],
  },
  ...(["昼", "夜"] as const).map(
    (t): Item => ({
      id: t === "昼" ? "haisetsu_basho_hiru" : "haisetsu_basho_yoru",
      label: `排泄の場所（${t}）`,
      section: "haisetsu",
      type: "single",
      sentence: (s) => `${t === "昼" ? "日中" : "夜間"}は${s}。`,
      choices: [c("トイレ"), c("ポータブルトイレ"), c("尿器・便器"), c("おむつ内")],
    }),
  ),
  ...(["昼", "夜"] as const).map(
    (t): Item => ({
      id: t === "昼" ? "haisetsu_mono_hiru" : "haisetsu_mono_yoru",
      label: `使っているもの（${t}）`,
      section: "haisetsu",
      type: "multi",
      sentence: (s) => `${t === "昼" ? "日中" : "夜間"}は${s}を使用。`,
      choices: [
        c("布の下着"),
        c("尿とりパッド"),
        c("リハビリパンツ"),
        c("テープ式おむつ"),
        c("尿道カテーテル"),
        c("ストーマ"),
      ],
    }),
  ),
  {
    id: "haisetsu_dosa",
    label: "動作の介助",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `排泄動作は${s}。`,
    choices: [c("自立"), c("見守り"), c("一部介助（拭く・衣類の上げ下げ等）"), c("全介助")],
  },
  {
    id: "haisetsu_shikkin",
    label: "失禁",
    section: "haisetsu",
    type: "single",
    choices: [
      full("ない", "失禁なし。"),
      full("ときどきある（尿）", "尿失禁がときどきある。"),
      full("ときどきある（便）", "便失禁がときどきある。"),
      full("毎日ある", "失禁が毎日ある。"),
    ],
  },
  {
    id: "haisetsu_yakan",
    label: "夜間のトイレの回数",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `夜間のトイレは${s}。`,
    choices: [c("0回"), c("1〜2回"), c("3回以上")],
  },
  {
    id: "haisetsu_bentsu",
    label: "便通",
    section: "haisetsu",
    type: "single",
    sentence: (s) => `便通は${s}。`,
    choices: [
      c("毎日"),
      c("2〜3日に1回"),
      c("それ以上あく", "3日より間があく"),
      full("下剤を使っている", "下剤を使用。"),
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
      if (kind && equip) return `トイレは${kind}で${equip}を使用。`;
      if (kind) return `トイレは${kind}。`;
      return `トイレは${equip}を使用。`;
    },
  },

  /* ===== 入浴 =====
   * 場所と回数は1文（JOINS）。 */
  {
    id: "nyuyoku_basho",
    label: "入浴の場所",
    section: "nyuyoku",
    type: "single",
    choices: [
      { value: "自宅の浴槽", place: (k) => `自宅の浴槽で${k}入浴。` },
      { value: "自宅のシャワーのみ", place: (k) => (k ? `自宅で${k}、シャワー浴のみ。` : "自宅でシャワー浴のみ。") },
      {
        value: "住まいの施設の浴室（住宅型有料老人ホーム・サ高住等）",
        place: (k) => `住まいの施設の浴室で${k}入浴。`,
      },
      { value: "通所サービス", place: (k) => `通所サービスで${k}入浴。` },
      { value: "訪問入浴", place: (k) => `訪問入浴を${k}利用。` },
      { value: "清拭のみ", place: (k) => (k ? `入浴はせず、清拭のみ（${k}）。` : "入浴はせず、清拭のみ。") },
    ],
  },
  {
    id: "nyuyoku_kaisu",
    label: "回数",
    section: "nyuyoku",
    type: "single",
    choices: [c("週3回以上"), c("週2回"), c("週1回"), c("それ未満", "週1回未満")],
  },
  {
    id: "nyuyoku_level",
    label: "介助の程度",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴動作は${s}。`,
    choices: LEVEL4,
  },
  {
    id: "nyuyoku_bubun",
    label: "介助が必要な部分",
    section: "nyuyoku",
    type: "multi",
    optional: true,
    sentence: (s) => `${s}に介助。`,
    choices: [c("浴槽の出入り"), c("洗身（背中・足先）"), c("洗髪"), c("脱衣場の移動"), c("着替え")],
  },
  {
    id: "nyuyoku_mono",
    label: "使っているもの",
    section: "nyuyoku",
    type: "multi",
    sentence: (s) => `${s}を使用。`,
    choices: [
      c("手すり"),
      c("シャワーチェア"),
      c("浴槽台"),
      c("バスボード"),
      c("すべり止めマット"),
      none("浴室で使うものは特になし。"),
    ],
  },
  {
    id: "nyuyoku_ikou",
    label: "本人の意向",
    section: "nyuyoku",
    type: "single",
    sentence: (s) => `入浴に${s}。`,
    choices: [
      full("入りたがっている", "入浴を希望する様子。"),
      c("気が進まない様子"),
      full("特に話はない", "入浴について本人から特に話はない。"),
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
      choices: [c("自立"), c("時間はかかるが自立"), c("見守り・声かけ"), c("一部介助"), c("全介助")],
    }),
  ),
  {
    id: "koi_erabu",
    label: "服を選ぶ",
    section: "koi",
    type: "single",
    sentence: (s) => `衣類は${s}。`,
    choices: [
      c("季節に合わせて選べている", "季節に合わせて選べる"),
      c("声かけがあれば選べている", "声かけがあれば選べる"),
      c("家族が用意している", "家族が用意"),
    ],
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
      choices: [c("自立"), c("声かけで実施"), c("一部介助"), c("全介助")],
    }),
  ),
  {
    id: "seiyo_tsume",
    label: "爪切り",
    section: "koi",
    type: "single",
    sentence: (s) => `爪切りは${s}。`,
    choices: [
      c("本人が行っている", "本人"),
      c("家族が行っている", "家族"),
      c("サービスで行っている", "サービスで実施"),
      c("施設職員が行っている", "施設職員"),
      c("行えていない"),
    ],
  },

  /* ===== 服薬 =====
   * 薬の名前や量は扱わない。「服薬なし」なら飲む動作・工夫・飲み忘れ・残薬は出さない。 */
  {
    id: "fuku_kanri",
    label: "薬の管理",
    section: "fukuyaku",
    type: "single",
    sentence: (s) => `薬は${s}。`,
    choices: [
      c("本人が管理"),
      c("家族が管理"),
      c("施設職員が管理"),
      c("訪問看護が管理"),
      full("薬剤師（居宅療養管理指導）が関わっている", "薬の管理に薬剤師（居宅療養管理指導）が関わる。"),
      full(NO_MEDICINE, "服薬なし。"),
    ],
  },
  ...(
    [
      {
        id: "fuku_dosa",
        label: "飲む動作",
        section: "fukuyaku",
        type: "single",
        sentence: (s) => `服薬は${s}。`,
        choices: [
          c("自分で飲んでいる", "自分で飲む"),
          c("手渡しすれば飲んでいる", "手渡しすれば飲む"),
          c("手渡しし、飲み込むまで確認が必要"),
          c("口まで運ぶ介助が必要"),
        ],
      },
      {
        id: "fuku_kufu",
        label: "工夫しているもの",
        section: "fukuyaku",
        type: "multi",
        sentence: (s) => `${s}を使用。`,
        choices: [
          c("一包化"),
          c("お薬カレンダー"),
          c("服薬ボックス"),
          c("服薬支援の機器"),
          none("服薬の工夫は特になし。"),
        ],
      },
      {
        id: "fuku_wasure",
        label: "飲み忘れ",
        section: "fukuyaku",
        type: "single",
        sentence: (s) => `飲み忘れが${s}。`,
        choices: [
          full("ほとんどない", "飲み忘れはほとんどない。"),
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
        sentence: (s) => `訪問時、残薬${s}。`,
        choices: [c("あった", "あり"), c("なかった", "なし")],
      },
    ] satisfies Item[]
  ).map((item): Item => ({ ...item, skipIf: (sel) => sel.fuku_kanri === NO_MEDICINE })),
  {
    id: "fuku_tsuin",
    label: "通院",
    section: "fukuyaku",
    type: "single",
    choices: [
      full("定期的に受診している", "医療機関を定期的に受診。"),
      full("訪問診療", "訪問診療を利用。"),
      full("受診が途切れている", "医療機関の受診が途切れている。"),
    ],
  },
  {
    id: "fuku_tsukisoi",
    label: "通院の付き添い",
    section: "fukuyaku",
    type: "single",
    sentence: (s) => `通院の付き添いは${s}。`,
    choices: [
      full("なし（本人のみ）", "通院は本人のみ。"),
      c("家族"),
      c("施設職員"),
      c("サービス（通院等乗降介助等）"),
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
      c("本人"),
      c("本人（簡単なものだけ）"),
      c("家族"),
      c("ヘルパー"),
      c("配食・購入で対応"),
      c("家族とヘルパーで分担"),
      c("施設の食事で対応"),
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
      choices: [c("本人"), c("家族"), c("ヘルパー"), c("家族とヘルパーで分担"), c("施設職員"), c("行えていない")],
    }),
  ),
  {
    id: "kaji_kaimono",
    label: "買い物",
    section: "kaji",
    type: "single",
    subject: "買い物",
    choices: [
      c("本人"),
      c("家族"),
      c("ヘルパー"),
      c("宅配・ネットスーパー", "宅配・ネットスーパーを利用"),
      c("移動販売", "移動販売を利用"),
      c("施設職員"),
    ],
  },
  {
    id: "kaji_gomi",
    label: "ゴミ出し",
    section: "kaji",
    type: "single",
    subject: "ゴミ出し",
    choices: [c("本人"), c("家族"), c("ヘルパー"), c("近所の人"), c("施設職員")],
  },
  {
    id: "kaji_okane",
    label: "お金の管理",
    section: "kaji",
    type: "single",
    sentence: (s) => `金銭管理は${s}。`,
    choices: [
      c("本人"),
      c("本人（家族が確認）"),
      c("家族"),
      c("成年後見人等"),
      c("日常生活自立支援事業", "日常生活自立支援事業を利用"),
      c("施設で預かり管理"),
    ],
  },
  {
    id: "kaji_shorui",
    label: "書類・郵便物の管理",
    section: "kaji",
    type: "single",
    sentence: (s) => `書類・郵便物は${s}。`,
    choices: [
      c("本人", "本人が管理"),
      c("家族", "家族が管理"),
      c("施設職員が受け取り"),
      full("溜まっている様子", "郵便物が溜まっている様子。"),
    ],
  },
  {
    id: "kaji_denwa",
    label: "電話の使用",
    section: "kaji",
    type: "single",
    sentence: (s) => `電話は${s}。`,
    choices: [c("自分でかけられる"), c("受けるだけ"), c("使っていない")],
  },

  /* ===== コミュニケーション・認知 =====
   * 評価の言葉は出さない。見た様子は「様子あり」、聞いた話は「と聞く」で分ける。 */
  {
    id: "ninchi_shiryoku",
    label: "視力",
    section: "ninchi",
    type: "single",
    sentence: (s) => `視力は${s}。`,
    choices: [c("日常生活に支障なし"), c("眼鏡で支障なし"), c("大きい字なら読める"), c("ほとんど見えない")],
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
      full("補聴器を使用", "補聴器を使用。"),
      c("ほとんど聞こえない"),
    ],
  },
  {
    id: "ninchi_kaiwa",
    label: "会話",
    section: "ninchi",
    type: "single",
    sentence: (s) => `${s}。`,
    choices: [
      c("普通に会話できる"),
      c("簡単な内容なら会話できる"),
      c("身ぶりや表情でのやり取りが中心"),
      c("発語が少ない"),
    ],
  },
  {
    id: "ninchi_ishi",
    label: "意思の伝え方",
    section: "ninchi",
    type: "single",
    sentence: (s) => `希望は${s}。`,
    choices: [
      c("自分から伝えられる"),
      c("聞かれれば答えられる"),
      full("伝えることが難しい様子", "希望を伝えることが難しい様子。"),
    ],
  },
  {
    id: "ninchi_houmon",
    label: "訪問時に見られたこと",
    section: "ninchi",
    type: "multi",
    choices: [
      { value: "同じ話を繰り返す", kind: "seen", say: "同じ話を繰り返す様子あり", link: "同じ話を繰り返す様子があり" },
      { value: "日付・曜日を答えられなかった", kind: "seen", say: "日付・曜日を答えられなかった", link: "日付・曜日を答えられず" },
      { value: "訪問の約束を覚えていなかった", kind: "seen", say: "訪問の約束を覚えていなかった", link: "訪問の約束を覚えておらず" },
      { value: "置き忘れ・しまい忘れがあると聞いた", kind: "heard", say: "置き忘れ・しまい忘れがある", link: "置き忘れ・しまい忘れがあり" },
      { value: "鍋を焦がしたことがあると聞いた", kind: "heard", say: "鍋を焦がしたことがある", link: "鍋を焦がしたことがあり" },
      none("訪問時、特に見られたことなし。"),
    ],
    // 見た様子（訪問時、〜）と聞いた話（〜と聞く）で文を分ける。
    // 誰から聞いたかは選択肢にないので書かない（必要なら備考に書く）
    render: (picked) => {
      const chain = (ps: Choice[]) => ps.map((p, i) => (i < ps.length - 1 ? p.link : p.say)).join("、");
      const seen = picked.filter((p) => p.kind === "seen");
      const heard = picked.filter((p) => p.kind === "heard");
      return (seen.length ? `訪問時、${chain(seen)}。` : "") + (heard.length ? `${chain(heard)}と聞く。` : "");
    },
  },
  {
    id: "ninchi_kitaku",
    label: "一人で外出して帰りに時間がかかることがあるか",
    section: "ninchi",
    type: "single",
    choices: [
      full("ない", "一人で外出し、帰宅に時間がかかったことはないと聞く。"),
      full("あったと聞いた", "一人で外出し、帰宅に時間がかかったことがあったと聞く。"),
    ],
  },
  {
    id: "ninchi_kibun",
    label: "気分・意欲（見られた様子）",
    section: "ninchi",
    type: "single",
    sentence: (s) => `訪問時、${s}。`,
    choices: [
      c("変わりない", "気分・意欲に普段と変わった様子なし"),
      c("口数が少ない", "口数が少ない様子"),
      c("涙ぐむ場面があった", "涙ぐむ場面あり"),
      c("「何もしたくない」等の発言があった", "「何もしたくない」等の発言あり"),
    ],
  },
  {
    id: "ninchi_nichu",
    label: "日中の過ごし方",
    section: "ninchi",
    type: "single",
    sentence: (s) => `日中は${s}と聞く。`,
    choices: [
      c("起きて過ごしている"),
      c("横になっている時間が長い"),
      c("テレビ中心"),
      c("趣味・畑仕事等をしている"),
    ],
  },
];

/**
 * 同じ値を選んだら1文にまとめる項目の組（subject を持つ項目）。
 * 例：寝返り・起き上がりが同じ → 「寝返り・起き上がりは自立。」
 */
export const MERGE_GROUPS: { ids: string[] }[] = [
  { ids: ["kihon_negaeri", "kihon_okiagari", "kihon_tachiagari"] },
  { ids: ["haisetsu_nyoui", "haisetsu_beni"] },
  { ids: ["koi_ue", "koi_shita", "koi_kutsu"] },
  { ids: ["seiyo_sengan", "seiyo_seihatsu"] },
  { ids: ["kaji_chori", "kaji_soji", "kaji_sentaku", "kaji_kaimono", "kaji_gomi"] },
];

/**
 * 昼と夜が同じなら1文にまとめる項目の組。
 * both には同じ言い方 s が渡る。
 */
export const PAIRS: { a: string; b: string; both: (s: string) => string }[] = [
  { a: "haisetsu_basho_hiru", b: "haisetsu_basho_yoru", both: (s) => `日中・夜間とも${s}。` },
  { a: "haisetsu_mono_hiru", b: "haisetsu_mono_yoru", both: (s) => `日中・夜間とも${s}を使用。` },
];

/**
 * 2つの項目をいつも1文にする組（入浴の場所と回数：「通所サービスで週2回入浴。」）。
 * render には選んだ選択肢（未選択なら null）が渡る。
 */
export const JOINS: { a: string; b: string; render: (a: Choice | null, b: Choice | null) => string }[] = [
  {
    a: "nyuyoku_basho",
    b: "nyuyoku_kaisu",
    render: (place, count) => {
      const k = count ? (count.say ?? count.value) : "";
      if (place?.place) return place.place(k);
      return k ? `入浴は${k}。` : "";
    },
  },
];

/** 移動（屋内・屋外）の4項目。build.ts の専用処理で使う */
export const MOVE_IDS = {
  inTool: "ido_in_tool",
  inLevel: "ido_in_level",
  outTool: "ido_out_tool",
  outLevel: "ido_out_level",
} as const;
