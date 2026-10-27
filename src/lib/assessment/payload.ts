/* =====================================================================
 *  選択式アセスメント 保存リクエストの検証
 * ---------------------------------------------------------------------
 *  画面から送られてきた内容を確かめ、DB に入れる形に整える純粋関数。
 *  ★文章は画面から受け取らず、選んだ内容からここで作り直す（選択と文章を必ず一致させる）。
 *  ★テンプレートにない項目・選択肢は受け付けない。
 * ===================================================================== */
import { buildAssessmentText, choicesFor } from "./build.ts";
import { ITEMS, TEMPLATE_VERSION, type Selections } from "./templates.ts";

export const DISPLAY_NAME_MAX = 20;
export const FAMILY_MAX = 10;
export const FAMILY_NAME_MAX = 10;
export const TEXT_ANSWER_MAX = 40;

/** assessments テーブルに入れる列（user_id 以外） */
export type AssessmentRow = {
  display_name: string;
  assessed_on: string;
  family: string[];
  selections: Selections;
  include_unconfirmed: boolean;
  generated_text: string;
  template_version: number;
  unconfirmed_count: number;
};

export type ParseResult = { ok: true; row: AssessmentRow } | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseAssessmentPayload(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) return fail("リクエストの形式が不正です。");
  const b = body as Record<string, unknown>;

  const displayName = typeof b.displayName === "string" ? b.displayName.trim() : "";
  if (displayName === "") return fail("利用者の表示名（イニシャル）を入力してください。");
  if (displayName.length > DISPLAY_NAME_MAX) {
    return fail(`利用者の表示名は${DISPLAY_NAME_MAX}文字以内にしてください。`);
  }

  const assessedOn = typeof b.assessedOn === "string" ? b.assessedOn : "";
  if (!isValidDate(assessedOn)) return fail("実施日を正しく入力してください。");

  if (!Array.isArray(b.family) || b.family.length > FAMILY_MAX) {
    return fail(`続柄は${FAMILY_MAX}件までにしてください。`);
  }
  const family: string[] = [];
  for (const f of b.family) {
    const name = typeof f === "string" ? f.trim() : "";
    if (name === "" || name.length > FAMILY_NAME_MAX || name === "家族" || family.includes(name)) {
      return fail("続柄の内容が正しくありません。");
    }
    family.push(name);
  }

  if (typeof b.includeUnconfirmed !== "boolean") return fail("リクエストの形式が不正です。");
  const includeUnconfirmed = b.includeUnconfirmed;

  if (typeof b.selections !== "object" || b.selections === null || Array.isArray(b.selections)) {
    return fail("リクエストの形式が不正です。");
  }
  const raw = b.selections as Record<string, unknown>;
  const selections: Selections = {};
  for (const [id, value] of Object.entries(raw)) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return fail("アセスメントにない項目が含まれています。");

    if (item.type === "text") {
      const text = typeof value === "string" ? value.trim() : "";
      if (text === "" || text.length > TEXT_ANSWER_MAX) {
        return fail(`「${item.label}」は${TEXT_ANSWER_MAX}文字以内で入力してください。`);
      }
      selections[id] = text;
      continue;
    }

    const available = new Set(choicesFor(item, family).map((c) => c.value));
    if (item.type === "single") {
      if (typeof value !== "string" || !available.has(value)) {
        return fail(`「${item.label}」の選択が正しくありません。`);
      }
      selections[id] = value;
      continue;
    }

    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      new Set(value).size !== value.length ||
      !value.every((v) => typeof v === "string" && available.has(v))
    ) {
      return fail(`「${item.label}」の選択が正しくありません。`);
    }
    selections[id] = value as string[];
  }

  const built = buildAssessmentText({ selections, family, includeUnconfirmed });
  return {
    ok: true,
    row: {
      display_name: displayName,
      assessed_on: assessedOn,
      family,
      selections,
      include_unconfirmed: includeUnconfirmed,
      generated_text: built.text,
      template_version: TEMPLATE_VERSION,
      unconfirmed_count: built.unconfirmedCount,
    },
  };
}
