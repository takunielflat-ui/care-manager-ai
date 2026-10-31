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
  // 人名: 「様」「さん」「氏」「ちゃん」が付く氏名を対象にする。
  // 漢字1〜4文字（「林さん」のような1文字の姓も含む）と、カタカナ2〜6文字（「トメさん」等）。
  // 「様子」「様式」「氏名」のように敬称ではない「様」「氏」は後ろの文字で除外する。
  {
    category: "person",
    pattern: /([一-龥]{1,4}|[ァ-ヶー]{2,6})(様(?![々子式相態])|さん|氏(?!名)|ちゃん)/g,
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
  "医者", "歯医者", "保健師", "栄養士", "社会福祉士", "介護福祉士", "相談支援専門員",
  // 1文字で「〜さん/様」になる一般語（1文字の姓を拾うようにしたため除外が必要）
  "皆", "奥", "嫁", "婆", "爺", "客", "神", "仏", "王", "殿", "赤", "坊", "嬢", "旦那", "大家",
  // カタカナの職種・呼び方
  "ヘルパー", "ケアマネ", "ケアマネジャー", "ケアマネージャー", "マネジャー", "マネージャー",
  "ナース", "ドクター", "スタッフ", "ドライバー", "セラピスト", "リハ", "ママ", "パパ",
]);

/**
 * 「同様」「多様」のように、直前の1文字と合わせて一般語になる「様」「氏」。
 * 人名パターンは前の漢字を最大4文字まで取り込むため（「前回同様」→「前回同」+「様」）、
 * 末尾の1文字＋敬称の組み合わせで判定して除外する。
 */
const NON_PERSON_TAILS = new Set([
  "同様", "多様", "模様", "異様", "仕様", "左様", "斯様",
  "同氏", "両氏", "某氏", "彼氏", "諸氏",
]);

/**
 * 人名パターンにマッチした識別部分が、実際には人名でない場合は true。
 * 「訪問看護師さん」のように職種の前に別の漢字が付いて4文字を超える場合も、
 * 末尾が職種・続柄の語であれば人名ではないと判断する。
 */
function isNonPersonName(name: string, honorific: string) {
  if (NON_PERSON_TAILS.has(name.slice(-1) + honorific)) return true;
  for (const word of NON_PERSON_WORDS) {
    if (name === word) return true;
    if (word.length >= 2 && name.endsWith(word)) return true;
  }
  return false;
}

/**
 * 「長女恵子さん」のように続柄・職種の直後に名前が続く場合、その続柄部分を返す。
 * 続柄は残して名前だけを伏せることで、AIが「誰の発言か」を書き分けられるようにする。
 */
function leadingNonPersonWord(name: string) {
  let longest = "";
  for (const word of NON_PERSON_WORDS) {
    if (word.length >= 2 && name.startsWith(word) && name.length > word.length && word.length > longest.length) {
      longest = word;
    }
  }
  return longest;
}

/**
 * 電話番号・郵便番号。人名と違ってラベルで区別する必要がないため、種類だけを残す。
 * 日付（2026-10-12）や数値（体温36.5）に当たらないよう、先頭の0や〒で限定する。
 */
const CONTACT_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /〒\s?\d{3}[-－‐ー]?\d{4}/g, replacement: "（郵便番号）" },
  { pattern: /(?<!\d)0\d{1,4}[-－‐ー]\d{1,4}[-－‐ー]\d{3,4}(?!\d)/g, replacement: "（電話番号）" },
  { pattern: /(?<!\d)0\d{9,10}(?!\d)/g, replacement: "（電話番号）" },
];

/** 漢字・ひらがな・カタカナを含むか（イニシャルなど英字だけの表示名は本文から探さない） */
const HAS_JAPANESE = /[一-龥ぁ-んァ-ヶ]/;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 生成後に実名へ戻すための対応表。カテゴリごとに「ラベルの語幹（"B" / "Y2" など）→ 元の語」。
 * 実名そのものを持つため、1回の生成リクエストの間だけメモリ上で使い、DB・ログには出さないこと。
 * 使い終わったら clearRestoreMap() で破棄する。
 */
export type RestoreMap = Record<Category, Map<string, string>>;

/** カテゴリごとに「識別文字列 → プレースホルダー」を記憶し、同じ入力には同じラベルを返す。 */
class PlaceholderRegistry {
  private readonly map = new Map<string, string>();
  /** ラベルの語幹 → 元の語（復元用） */
  readonly originals = new Map<string, string>();

  /** original は復元時に戻す語。省略時は rawName（人名は敬称を除いた名前だけを戻す）。 */
  resolve(rawName: string, makeStem: (count: number) => string, suffix: string, original = rawName) {
    const key = rawName.trim();
    const cached = this.map.get(key);
    if (cached) return cached;

    const stem = makeStem(this.map.size);
    const label = `${stem}${suffix}`;
    this.map.set(key, label);
    this.originals.set(stem, original.trim());
    return label;
  }
}

/**
 * displayName・note の実名/固有名詞をプレースホルダーへ置換した新しい文字列と、
 * 生成結果を実名へ戻すための対応表（restoreMap）を返す。
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
    registries.person.resolve(rawName, personRule.nextPrefix, personRule.placeholderSuffix!);

  // displayNameを1人目の人物として先に登録しておく。末尾の敬称は正規化のため取り除く。
  const primaryPersonName = input.displayName.trim().replace(PERSON_HONORIFIC_SUFFIX_PATTERN, "");
  if (primaryPersonName) {
    resolvePerson(primaryPersonName);
  }

  let anonymizedNote = input.note;

  for (const { pattern, replacement } of CONTACT_PATTERNS) {
    anonymizedNote = anonymizedNote.replace(pattern, replacement);
  }

  // 利用者表示名そのものを本文からも探して伏せる。敬称が付いていない書き方
  // （「山田花子 本人宅訪問」「花子は笑顔」）は人名パターンでは拾えないため。
  // 姓・名に分かれていれば、それぞれ（2文字以上のもの）も同じラベルに置き換える。
  if (primaryPersonName && HAS_JAPANESE.test(primaryPersonName)) {
    const label = resolvePerson(primaryPersonName);
    const variants = new Set([primaryPersonName, primaryPersonName.replace(/\s+/g, "")]);
    for (const part of primaryPersonName.split(/\s+/)) {
      if (part.length >= 2 && HAS_JAPANESE.test(part)) variants.add(part);
    }
    // 長い表記から先に置き換える（「山田花子」を「山田」より先に処理する）
    for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
      const literalPattern = new RegExp(`${escapeRegExp(variant)}(?:様|さん|氏|ちゃん)?`, "g");
      anonymizedNote = anonymizedNote.replace(literalPattern, label);
    }
  }

  for (const rule of RULES) {
    anonymizedNote = anonymizedNote.replace(rule.pattern, (match, name: string, typeWord: string) => {
      if (rule.category === "person") {
        if (isNonPersonName(name, typeWord)) return match;
        const prefix = leadingNonPersonWord(name);
        if (prefix) return prefix + resolvePerson(name.slice(prefix.length));
      }
      const suffix = rule.placeholderSuffix ?? typeWord;
      // 人名は名前だけを戻し（敬称はAIの書いたものを残す）、それ以外は種別語ごと戻す
      const original = rule.category === "person" ? name : match;
      return registries[rule.category].resolve(name, rule.nextPrefix, suffix, original);
    });
  }

  // 辞書登録された、接尾辞のない固有名詞をリテラル置換する。
  for (const category of CATEGORIES) {
    const rule = RULES.find((r) => r.category === category)!;
    for (const name of knownNames[category]) {
      const literalPattern = new RegExp(escapeRegExp(name), "g");
      anonymizedNote = anonymizedNote.replace(literalPattern, () =>
        registries[category].resolve(name, rule.nextPrefix, CATEGORY_SUFFIX[category]),
      );
    }
  }

  const anonymizedDisplayName = primaryPersonName ? resolvePerson(primaryPersonName) : input.displayName;

  const restoreMap: RestoreMap = {
    person: registries.person.originals,
    hospital: registries.hospital.originals,
    facility: registries.facility.originals,
    place: registries.place.originals,
  };

  return { displayName: anonymizedDisplayName, note: anonymizedNote, restoreMap };
}

/* ---------------------------------------------------------------------
 *  生成後の復元（AIの出力に含まれるラベルを実名へ戻す）
 *  Anthropic API から返ってきた後にだけ使う。送信前のテキストには使わないこと。
 * ------------------------------------------------------------------- */

const CATEGORIES: Category[] = ["person", "hospital", "facility", "place"];

/**
 * ラベルの後ろ（「B様」）・前（「事業所Y」）に付きうる語。AIは送ったラベルをそのまま
 * 使うとは限らない（「B様」→「B氏」「Bさん」）ため、表記ゆれを含めて拾う。
 */
const RESTORE_SUFFIXES: Record<Category, string> = {
  person: "様|さん|氏|ちゃん|くん|君",
  hospital: "病院|医院|クリニック|診療所",
  facility: "事業所|事業者",
  place: "地域|市|区|町|村|駅",
};
const RESTORE_PREFIXES: Partial<Record<Category, string>> = {
  hospital: "病院|医院|クリニック|診療所",
  facility: "事業所",
  place: "地域",
};

/** 英数字（半角・全角）。ラベルの語幹の前後がこれだと別の単語の一部なので置き換えない。 */
const ALNUM = "A-Za-z0-9Ａ-Ｚａ-ｚ０-９";

/** "B2" → "[BＢ][2２]"（AIが全角で書いてきても拾う） */
function stemPattern(stem: string) {
  return [...stem]
    .map((char) => `[${escapeRegExp(char)}${String.fromCharCode(char.charCodeAt(0) + 0xfee0)}]`)
    .join("");
}

/**
 * AIの出力に含まれるラベルを、対応表を使って元の語へ戻す。
 * 人名は「B氏」→「小林氏」のようにAIが付けた敬称を残し、施設等は「Y事業所」「事業所Y」→「さくら訪問介護」とする。
 * 敬称・種別語の付かない裸の「B」は戻さない（「X線」などの一般語を壊さないため）。
 */
export function restoreFromAI(text: string, restoreMap: RestoreMap) {
  let restored = text;
  for (const category of CATEGORIES) {
    // 長い語幹から先に処理する（"Y2" と "Y" の取り違え防止。前後の英数字チェックでも防いでいる）
    const stems = [...restoreMap[category].keys()].sort((a, b) => b.length - a.length);
    for (const stem of stems) {
      const original = restoreMap[category].get(stem)!;
      const core = `(?<![${ALNUM}])${stemPattern(stem)}(?![${ALNUM}])`;
      const suffixPattern = new RegExp(`${core}(${RESTORE_SUFFIXES[category]})`, "g");
      restored = restored.replace(suffixPattern, (_match, word: string) =>
        // 人名は敬称を残す。施設等は元の語に種別語が含まれているので付け直さない
        category === "person" ? original + word : original,
      );
      const prefixes = RESTORE_PREFIXES[category];
      if (prefixes) {
        restored = restored.replace(new RegExp(`(?:${prefixes})${core}`, "g"), () => original);
      }
    }
  }
  return restored;
}

/** 復元後に残っていたらおかしい、ラベルの形をした語（「C氏」「Y3事業所」「事業所Y」など）。 */
const LEFTOVER_PATTERN = new RegExp(
  `(?<![${ALNUM}])[A-ZＡ-Ｚ]{1,2}[0-9０-９]*(?:様|さん|氏|ちゃん|事業所|病院|医院|クリニック|診療所|地域)` +
    `|事業所[A-ZＡ-Ｚ]{1,2}[0-9０-９]*(?![${ALNUM}])`,
  "g",
);

/**
 * 復元後のテキストに、ラベルの形をした語が残っていれば true。
 * source（利用者が入力した表示名・メモ）に元からある語（イニシャルの「A様」など）は除く。
 * 戻り値は真偽値だけにして、どの語が残ったかは呼び出し側に渡さない（実名がログに漏れないように）。
 */
export function hasUnrestoredPlaceholder(restoredText: string, source: string) {
  for (const match of restoredText.matchAll(LEFTOVER_PATTERN)) {
    if (!source.includes(match[0])) return true;
  }
  return false;
}

/**
 * AIへ送る文章に、対応表の元の語（＝匿名化で伏せたはずの実名）が残っていれば true。
 * 英字だけの語（イニシャル）は一般語と区別できないため対象外。
 * 匿名化が名前だと認識できなかった語（敬称なしの「小林から電話」など）は対応表にないため検出できない。
 */
export function containsOriginalTerm(text: string, restoreMap: RestoreMap) {
  for (const category of CATEGORIES) {
    for (const original of restoreMap[category].values()) {
      if (HAS_JAPANESE.test(original) && text.includes(original)) return true;
    }
  }
  return false;
}

/** 対応表を空にする。生成の完了・失敗・中断のいずれでも必ず呼ぶ。 */
export function clearRestoreMap(restoreMap: RestoreMap) {
  for (const category of CATEGORIES) restoreMap[category].clear();
}

/**
 * ストリーミング中の差分（delta）を復元しながら中継するためのバッファ。
 * 差分の切れ目でラベルが分断される（「B」|「様」、「事業所」|「Y」）と置換できないため、
 * 英大文字の近く HOLD 文字ぶんは送らずに溜めておき、ラベルが切れていない位置までを復元して返す。
 * ラベル（前置き語＋語幹＋敬称/種別語）は最長でも十数文字なので、HOLD はそれより長くとる。
 */
const HOLD = 16;
const UPPERCASE = /[A-ZＡ-Ｚ]/;

export function createStreamRestorer(restoreMap: RestoreMap) {
  let pending = "";

  /** 前後 HOLD 文字に英大文字がない（＝ラベルをまたがない）切れ目のうち、最も後ろの位置。なければ 0。 */
  const safeCutIndex = () => {
    let cut = pending.length - HOLD;
    while (cut > 0) {
      const windowStart = Math.max(0, cut - HOLD);
      const found = pending.slice(windowStart, cut + HOLD).search(UPPERCASE);
      if (found === -1) return cut;
      cut = windowStart + found - HOLD;
    }
    return 0;
  };

  return {
    /** 差分を受け取り、確定して送ってよい部分を復元して返す（まだなければ空文字）。 */
    push(chunk: string) {
      pending += chunk;
      const cut = safeCutIndex();
      if (cut <= 0) return "";
      const ready = pending.slice(0, cut);
      pending = pending.slice(cut);
      return restoreFromAI(ready, restoreMap);
    },
    /** 生成完了時に、溜めていた残りをすべて復元して返す。 */
    flush() {
      const rest = restoreFromAI(pending, restoreMap);
      pending = "";
      return rest;
    },
  };
}
