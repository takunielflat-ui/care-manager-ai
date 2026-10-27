/* =====================================================================
 *  選択式アセスメント 文章の組み立て
 * ---------------------------------------------------------------------
 *  選んだ結果（selections）から、セクションごとの文章を作る純粋関数。
 *  ★AI は使わない機能です。Anthropic API や anonymizeForAI() を呼ばないこと。
 *  ★推測で埋めない。選ばれていない項目は【項目名：未確認】にする。
 * ===================================================================== */
import {
  ITEMS,
  MERGE_GROUPS,
  MOVE_IDS,
  PAIRS,
  SECTIONS,
  type Choice,
  type Item,
  type Selections,
} from "./templates.ts";

export type AssessmentInput = {
  selections: Selections;
  /** 登録した続柄（例：["長女", "夫"]）。入力されたものをそのまま使う */
  family: string[];
  /** true: 【項目名：未確認】を文中に出す / false: 出さない */
  includeUnconfirmed: boolean;
};

export type AssessmentResult = {
  text: string;
  unconfirmedCount: number;
  unconfirmedItems: string[];
  /** 未確認の項目ID（画面でセクションごとの件数や、最初の未確認へ移動するのに使う） */
  unconfirmedIds: string[];
};

const FAMILY = "家族";

/**
 * 画面に出す選択肢。value に「家族」を含む選択肢は、登録された続柄に置き換える。
 * 続柄が未登録なら「家族」のまま。
 */
export function choicesFor(item: Item, family: string[]): Choice[] {
  return item.choices.flatMap((ch) =>
    ch.value.includes(FAMILY) && family.length > 0 ? family.map((rel) => withRelation(ch, rel)) : [ch],
  );
}

function withRelation(ch: Choice, rel: string): Choice {
  const r = (s: string | undefined) => s?.replaceAll(FAMILY, rel);
  return {
    ...ch,
    value: r(ch.value)!,
    say: r(ch.say ?? ch.value),
    full: r(ch.full),
    link: r(ch.link),
  };
}

/**
 * 選んだ値を選択肢に引き当てる。未回答・選択肢にない値は null（＝未確認）。
 * 複数選択は選択肢の並び順にそろえ、「特になし」は他と一緒なら外す。
 */
function pick(item: Item, raw: string | string[] | undefined, family: string[]): Choice[] | null {
  if (item.type === "text") {
    const v = typeof raw === "string" ? raw.trim() : "";
    return v ? [{ value: v }] : null;
  }
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  if (item.type === "single" && values.length !== 1) return null;

  // 続柄に置き換えた選択肢に加え、「家族」のままの値も受け付ける
  const all = family.length > 0 ? [...choicesFor(item, family), ...choicesFor(item, [])] : choicesFor(item, []);
  let picked = all.filter((ch, i) => values.includes(ch.value) && all.findIndex((x) => x.value === ch.value) === i);
  if (picked.length > 1) picked = picked.filter((ch) => !ch.none);
  return picked.length > 0 ? picked : null;
}

const sayOf = (picked: Choice[]) => picked.map((p) => p.say ?? p.value).join("・");

/** 1文にまとめてよいか比べるための値。文全体を置き換える選択肢はまとめない */
const mergeKey = (picked: Choice[] | null) =>
  picked && !picked.some((p) => p.full) ? sayOf(picked) : null;

function sentenceOf(item: Item, picked: Choice[], suffix = ""): string {
  if (item.render && !picked[0].none) return item.render(picked);
  if (picked.length === 1 && picked[0].full) return picked[0].full;
  const s = sayOf(picked);
  if (item.subject) return `${item.subject}${suffix}は${s}。`;
  return item.sentence!(s);
}

type Piece = { text: string } | { missing: string };

export function buildAssessmentText(input: AssessmentInput): AssessmentResult {
  const { selections: sel, family, includeUnconfirmed } = input;
  const unconfirmedItems: string[] = [];
  const unconfirmedIds: string[] = [];
  const blocks: string[] = [];
  const byId = new Map(ITEMS.map((i) => [i.id, i]));
  const picks = new Map(ITEMS.map((i) => [i.id, i.skipIf?.(sel) ? null : pick(i, sel[i.id], family)]));

  for (const section of SECTIONS) {
    const pieces: Piece[] = [];
    const done = new Set<string>();
    const missing = (item: Item) => {
      unconfirmedItems.push(item.label);
      unconfirmedIds.push(item.id);
      pieces.push({ missing: item.label });
    };

    for (const item of ITEMS.filter((i) => i.section === section.id)) {
      if (done.has(item.id)) continue;
      done.add(item.id);
      if (item.skipIf?.(sel)) continue;

      if (item.id === MOVE_IDS.inTool) {
        Object.values(MOVE_IDS).forEach((id) => done.add(id));
        movement(picks, byId, sel, pieces, missing);
        continue;
      }

      const picked = picks.get(item.id)!;
      if (!picked) {
        if (!item.optional) missing(item);
        continue;
      }

      // 昼と夜が同じなら1文
      const pair = PAIRS.find((p) => p.a === item.id);
      if (pair) {
        const key = mergeKey(picked);
        if (key !== null && key === mergeKey(picks.get(pair.b)!)) {
          done.add(pair.b);
          pieces.push({ text: pair.both(key) });
          continue;
        }
      }

      // 同じ値を選んだ項目は1文（例：寝返り・起き上がりは自立している。）
      const group = MERGE_GROUPS.find((g) => g.ids.includes(item.id));
      if (group) {
        const key = mergeKey(picked);
        const same = group.ids
          .map((id) => byId.get(id)!)
          .filter((other) => !done.has(other.id) && key !== null && mergeKey(picks.get(other.id)!) === key);
        if (same.length > 0) {
          same.forEach((other) => done.add(other.id));
          const subjects = [item, ...same].map((i) => i.subject).join("・");
          pieces.push({ text: `${subjects}${group.suffix ?? ""}は${key}。` });
          continue;
        }
        pieces.push({ text: sentenceOf(item, picked, group.suffix) });
        continue;
      }

      pieces.push({ text: sentenceOf(item, picked) });
    }

    const body = pieces
      .map((p) => ("text" in p ? p.text : includeUnconfirmed ? `【${p.missing}：未確認】` : ""))
      .join("");
    if (body) blocks.push(`【${section.title}】\n${body}`);
  }

  return {
    text: blocks.join("\n\n"),
    unconfirmedCount: unconfirmedItems.length,
    unconfirmedItems,
    unconfirmedIds,
  };
}

/**
 * できあがった文章をセクションごとに分ける（介護ソフトの欄ごとに貼り付けるため）。
 * 「【基本動作】\n本文」が空行1つで並んだ形を前提にする。保存済みの古い版の文章にも使う。
 */
export function splitSections(text: string): { title: string; body: string }[] {
  if (text.trim() === "") return [];
  return text.split("\n\n").map((block) => {
    const match = block.match(/^【(.+?)】\n?([\s\S]*)$/);
    return match ? { title: match[1], body: match[2] } : { title: "", body: block };
  });
}

/**
 * 移動：屋内・屋外それぞれ「使うもの」と「介助の程度」から1文。
 * 屋内と屋外が両方とも同じなら「屋内外とも、移動は〜」の1文にまとめる。
 */
function movement(
  picks: Map<string, Choice[] | null>,
  byId: Map<string, Item>,
  sel: Selections,
  pieces: Piece[],
  missing: (item: Item) => void,
) {
  const one = (id: string) => picks.get(id)?.[0] ?? null;
  const inTool = one(MOVE_IDS.inTool);
  const inLevel = one(MOVE_IDS.inLevel);
  const outTool = one(MOVE_IDS.outTool);
  const outLevel = one(MOVE_IDS.outLevel);

  const heads = {
    in: { prefix: "屋内の移動は", head: "屋内は" },
    out: { prefix: "屋外の移動は", head: "屋外は" },
    both: { prefix: "屋内外とも、移動は", head: "屋内外とも、" },
  };

  const line = (
    place: keyof typeof heads,
    tool: Choice | null,
    level: Choice | null,
    toolId: string,
    levelId: string,
  ) => {
    const { prefix, head } = heads[place];
    if (tool?.full) {
      pieces.push({ text: tool.full });
      return;
    }
    if (!tool) missing(byId.get(toolId)!);
    if (tool && level) {
      pieces.push({
        text: level.tebiki ? `${head}${tool.use}手引きで移動している。` : `${prefix}${tool.means}${level.say}。`,
      });
    } else if (tool) {
      pieces.push({ text: `${prefix}${tool.alone}。` });
    } else if (level) {
      pieces.push({ text: level.tebiki ? `${head}手引きで移動している。` : `${prefix}${level.say}。` });
    }
    const levelSkipped = byId.get(levelId)!.skipIf?.(sel);
    if (!level && !levelSkipped) missing(byId.get(levelId)!);
  };

  if (inTool && inLevel && outTool && outLevel && inTool.value === outTool.value && inLevel.value === outLevel.value) {
    line("both", inTool, inLevel, MOVE_IDS.inTool, MOVE_IDS.inLevel);
    return;
  }
  line("in", inTool, inLevel, MOVE_IDS.inTool, MOVE_IDS.inLevel);
  line("out", outTool, outLevel, MOVE_IDS.outTool, MOVE_IDS.outLevel);
}
