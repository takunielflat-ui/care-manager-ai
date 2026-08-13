/**
 * AIへ送信する直前にだけ適用する匿名化レイヤー。
 * フォーム・DB・一覧画面など、これ以外の場所のデータは一切書き換えない。
 * 正規表現による決定的な置換のみで、NLPや完全自動化は行わない。
 */

export type Category = "person" | "hospital" | "facility" | "place";

export type KnownNames = Record<Category, string[]>;

export const EMPTY_KNOWN_NAMES: KnownNames = { person: [], hospital: [], facility: [], place: [] };

type Rule = {
  category: Category;
  /** グループ1: 識別部分（固有名詞）、グループ2: 種別語（病院/デイサービス等） */
  pattern: RegExp;
  /** 指定時はこの文字列を種別語として使う。省略時はマッチした種別語(グループ2)をそのまま使う。 */
  placeholderSuffix?: string;
  /** そのカテゴリで count 件目（0始まり）に割り当てるラベルの接頭辞部分。 */
  nextPrefix: (count: number) => string;
};

function letterForIndex(index: number) {
  // 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ...
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function fixedLetterPrefix(letter: string) {
  return (count: number) => (count === 0 ? letter : `${letter}${count + 1}`);
}

/**
 * 識別部分（固有名詞）に使える1文字。漢字・ひらがな・カタカナ・英数字を許すが、
 * 助詞（の/は/が/を/に/で/と/も/や/へ）はその場で弾く。
 * これがないと「御殿場のそよ風デイサービス」のように助詞をまたいで
 * 手前の単語（地名など）まで巻き込んで置換してしまう。
 */
const NAME_CHAR = "(?:(?!の|は|が|を|に|で|と|も|や|へ)[一-龥ぁ-んァ-ヶーa-zA-Z0-9])";

function entityPattern(suffixAlternation: string, min: number, max: number) {
  return new RegExp(`(${NAME_CHAR}{${min},${max}})(${suffixAlternation})`, "g");
}

const RULES: Rule[] = [
  // 人名: 「様」「さん」「氏」が付く2〜4文字の氏名を対象にする
  {
    category: "person",
    pattern: /([一-龥]{2,4})(様|さん|氏)/g,
    placeholderSuffix: "様",
    nextPrefix: letterForIndex,
  },
  // 病院名: 「〜病院/医院/クリニック/診療所」。種別語はそのまま残す（Xクリニック等になる）
  {
    category: "hospital",
    pattern: entityPattern("病院|医院|クリニック|診療所", 2, 15),
    nextPrefix: fixedLetterPrefix("X"),
  },
  // 施設名: 種別語は問わず「事業所」に統一する。
  // 長い語尾ほど先に置く（「デイサービス」を「デイ」より前に置かないと、
  // 「デイ」だけにマッチして「サービス」が置換されずに残ってしまう）。
  {
    category: "facility",
    pattern: entityPattern(
      "デイサービス|デイケア|デイ|ショートステイ|グループホーム|老人ホーム|ケアハウス|訪問介護|訪問看護|居宅介護支援事業所|地域包括支援センター|サービスセンター|事業所|ホーム|施設|苑",
      2,
      15,
    ),
    placeholderSuffix: "事業所",
    nextPrefix: fixedLetterPrefix("Y"),
  },
  // 地名: 「〜市/区/町/村/駅」
  {
    category: "place",
    pattern: entityPattern("市|区|町|村|駅", 2, 10),
    placeholderSuffix: "地域",
    nextPrefix: fixedLetterPrefix("Z"),
  },
];

const CATEGORY_SUFFIX: Record<Category, string> = {
  person: "様",
  hospital: "病院",
  facility: "事業所",
  place: "地域",
};

const PERSON_HONORIFIC_SUFFIX_PATTERN = /(様|さん|氏)$/;

/**
 * 「〜様/さん/氏」の形になっていても個人名ではない続柄・役職などの語。
 * これらは人名パターンにマッチしても匿名化の対象から除外する。
 */
const NON_PERSON_WORDS = new Set([
  // 続柄
  "本人", "ご本人", "長男", "長女", "次男", "次女", "三男", "三女", "四男", "四女",
  "息子", "娘", "夫", "妻", "父", "母", "祖父", "祖母", "曾祖父", "曾祖母",
  "兄", "弟", "姉", "妹", "伯父", "叔父", "伯母", "叔母", "甥", "姪", "孫",
  "義父", "義母", "義兄", "義弟", "義姉", "義妹", "元夫", "元妻",
  "同居人", "隣人", "友人", "知人", "後見人", "保証人",
  // 職種・役割
  "主治医", "担当医", "医師", "看護師", "薬剤師", "理学療法士", "作業療法士",
  "言語聴覚士", "相談員", "職員", "担当者", "施設長", "管理者", "責任者",
  "事務員", "訪問員", "介護士", "支援員", "患者", "利用者", "家族",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** カテゴリごとに「識別文字列 → プレースホルダー」を記憶し、同じ入力には同じラベルを返す。 */
class PlaceholderRegistry {
  private readonly map = new Map<string, string>();

  resolve(rawName: string, makeLabel: (count: number) => string) {
    const key = rawName.trim();
    const cached = this.map.get(key);
    if (cached) return cached;

    const label = makeLabel(this.map.size);
    this.map.set(key, label);
    return label;
  }
}

/**
 * displayName・note の実名/固有名詞をプレースホルダーへ置換した新しい文字列を返す。
 * 引数は変更しない（純粋関数）。呼び出しごとに新しいマッピングを作るため、
 * 「同一入力内では同じ固有名詞は同じプレースホルダー」という一貫性はこの1回の呼び出し内でのみ保証される。
 *
 * knownNames はユーザーごとにDB（known_names テーブル）で管理する、語尾のない固有名詞の辞書。
 * この関数自体はDBにアクセスしない（呼び出し側が取得して渡す）。
 */
export function anonymizeForAI(
  input: { displayName: string; note: string },
  knownNames: KnownNames = EMPTY_KNOWN_NAMES,
) {
  const registries: Record<Category, PlaceholderRegistry> = {
    person: new PlaceholderRegistry(),
    hospital: new PlaceholderRegistry(),
    facility: new PlaceholderRegistry(),
    place: new PlaceholderRegistry(),
  };

  const personRule = RULES.find((rule) => rule.category === "person")!;

  const resolvePerson = (rawName: string) =>
    registries.person.resolve(
      rawName,
      (count) => `${personRule.nextPrefix(count)}${personRule.placeholderSuffix}`,
    );

  // displayNameを1人目の人物として先に登録しておく。末尾の敬称は正規化のため取り除く。
  const primaryPersonName = input.displayName.trim().replace(PERSON_HONORIFIC_SUFFIX_PATTERN, "");
  if (primaryPersonName) {
    resolvePerson(primaryPersonName);
  }

  let anonymizedNote = input.note;

  for (const rule of RULES) {
    anonymizedNote = anonymizedNote.replace(rule.pattern, (match, name: string, typeWord: string) => {
      if (rule.category === "person" && NON_PERSON_WORDS.has(name)) return match;
      const suffix = rule.placeholderSuffix ?? typeWord;
      return registries[rule.category].resolve(
        name,
        (count) => `${rule.nextPrefix(count)}${suffix}`,
      );
    });
  }

  // 辞書登録された、接尾辞のない固有名詞をリテラル置換する。
  for (const category of ["person", "hospital", "facility", "place"] as Category[]) {
    const rule = RULES.find((r) => r.category === category)!;
    for (const name of knownNames[category]) {
      const literalPattern = new RegExp(escapeRegExp(name), "g");
      anonymizedNote = anonymizedNote.replace(literalPattern, () =>
        registries[category].resolve(
          name,
          (count) => `${rule.nextPrefix(count)}${CATEGORY_SUFFIX[category]}`,
        ),
      );
    }
  }

  const anonymizedDisplayName = primaryPersonName ? resolvePerson(primaryPersonName) : input.displayName;

  return { displayName: anonymizedDisplayName, note: anonymizedNote };
}
