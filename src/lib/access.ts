/* =====================================================================
 *  使える機能（権限）の判定
 * ---------------------------------------------------------------------
 *  権限は user_entitlements テーブル（1人1機能につき1行）で管理する。
 *    assessment  … アセスメント（AIは使わない）
 *    fifth_sheet … 経過記録（第5表の作成＝Anthropic APIの課金を伴う）
 *  行がない・expires_at が過ぎている・想定外の値の行は「権限なし」。
 *  行の追加・削除は運営者が Supabase で行う（アプリからは書き込めない。RLSで読み取りのみ）。
 *
 *  ★画面の振り分け（proxy.ts）も API も、毎回データベースで確かめる。
 *    proxy.ts が画面に渡す x-user-features ヘッダーは「表示を合わせるため」だけに使い、
 *    API はこのヘッダーを読まない（外から偽のヘッダーを送られても権限は増えない）。
 * ===================================================================== */
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const FEATURES = ["assessment", "fifth_sheet"] as const;
export type Feature = (typeof FEATURES)[number];

const isFeature = (value: unknown): value is Feature =>
  typeof value === "string" && (FEATURES as readonly string[]).includes(value);

/** UNLIMITED_GENERATION_EMAILS（カンマ区切り）に含まれるメールアドレスは上限の対象外にする */
export function isUnlimitedEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.UNLIMITED_GENERATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export type EntitlementRow = { feature?: unknown; expires_at?: string | null };

/**
 * user_entitlements の行から、今使える機能を返す。
 * expires_at が空なら無期限、今の時刻以前なら期限切れ（権限なし）。
 * 想定外の feature や、読めない日付は無視する（課金を伴う機能を誤って開放しないため）。
 */
export function activeFeatures(rows: EntitlementRow[] | null | undefined, now: Date = new Date()): Set<Feature> {
  const features = new Set<Feature>();
  for (const row of rows ?? []) {
    if (!isFeature(row.feature)) continue;
    if (row.expires_at) {
      const expires = new Date(row.expires_at);
      if (Number.isNaN(expires.getTime()) || expires <= now) continue;
    }
    features.add(row.feature);
  }
  return features;
}

/**
 * このユーザーが今使える機能を、データベースで確かめて返す。
 * - UNLIMITED_GENERATION_EMAILS の運営者アドレスは、DBを見ずにすべての機能（締め出し防止）
 * - 確認に失敗した場合は「権限なし」（課金を伴うため、安全側に倒す）
 */
export async function getFeatures(
  supabase: Pick<SupabaseClient, "from">,
  user: Pick<User, "id" | "email">,
  now: Date = new Date(),
): Promise<Set<Feature>> {
  if (isUnlimitedEmail(user.email)) return new Set(FEATURES);

  // RLS により自分の行だけが返る。念のため user_id でも絞る
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("feature, expires_at")
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to check user_entitlements:", error);
    return new Set();
  }
  return activeFeatures(data as EntitlementRow[], now);
}

/* ---------- API 用 ---------- */

export const FEATURE_DENIED_MESSAGE: Record<Feature, string> = {
  assessment: "アセスメントは、ご購入いただいた方がご利用いただけます。",
  fifth_sheet: "経過記録の作成は、ご利用中のプランには含まれていません。",
};

export type FeatureCheck =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; error: string };

/**
 * API の入口で使う確認。ログインしていて、その機能の権限が今あるかをデータベースで確かめる。
 * リクエストのヘッダー（x-user-features など）は一切見ない。
 */
export async function checkFeature(
  supabase: Pick<SupabaseClient, "from" | "auth">,
  feature: Feature,
  now: Date = new Date(),
): Promise<FeatureCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "ログインが必要です。" };

  const features = await getFeatures(supabase, user, now);
  if (!features.has(feature)) return { ok: false, status: 403, error: FEATURE_DENIED_MESSAGE[feature] };
  return { ok: true, user };
}

/* ---------- 画面の振り分け（proxy.ts 用） ---------- */

/** 権限が1つもない人に見せる案内ページ */
export const NO_ACCESS_PATH = "/no-access";
/** アセスメントの権限がない人に見せる購入案内（仮） */
export const ASSESSMENT_GUIDE_PATH = "/guide/assessment";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * その画面を開くのに必要な機能。null はログインしていれば誰でも開ける画面（案内ページ）。
 * アセスメント以外の画面（トップ・記録一覧・辞書設定・使い方）は経過記録の画面。
 */
export function requiredFeature(pathname: string): Feature | null {
  if (pathname === NO_ACCESS_PATH || under(pathname, ASSESSMENT_GUIDE_PATH)) return null;
  if (under(pathname, "/assessment")) return "assessment";
  return "fifth_sheet";
}

/** 使える機能に合わせた「最初の画面」 */
export function homePath(features: Set<Feature>): string {
  if (features.has("fifth_sheet")) return "/";
  if (features.has("assessment")) return "/assessment";
  return NO_ACCESS_PATH;
}

/**
 * ログイン済みの人がその画面を開けるか。開けなければ回す先のパス、開ければ null。
 * - 権限が1つもない → 案内ページ（案内ページ・購入案内はそのまま開ける）
 * - アセスメントの権限がない人がアセスメントを開いた → 購入案内
 * - 経過記録の権限がない人が経過記録の画面を開いた → 使える画面（アセスメント一覧 or 案内ページ）
 * - 権限がある人が案内ページ・購入案内を開いた → 使える画面へ戻す
 */
export function redirectFor(pathname: string, features: Set<Feature>): string | null {
  const required = requiredFeature(pathname);

  if (required === null) {
    if (pathname === NO_ACCESS_PATH && features.size > 0) return homePath(features);
    if (under(pathname, ASSESSMENT_GUIDE_PATH) && features.has("assessment")) return "/assessment";
    return null;
  }
  if (features.has(required)) return null;
  if (required === "assessment") return ASSESSMENT_GUIDE_PATH;
  return homePath(features);
}

/* ---------- 画面に渡すヘッダー ---------- */

/** proxy.ts が画面に渡す「使える機能」（例："assessment,fifth_sheet"）。表示を合わせるためだけに使う */
export const FEATURES_HEADER = "x-user-features";
export const EMAIL_HEADER = "x-user-email";

/**
 * 外から送られてきた同じ名前のヘッダーを必ず消してから、確かめた値で上書きする。
 * features・email が null（未ログインなど）なら消したまま何も入れない。
 */
export function setTrustedHeaders(
  headers: Headers,
  values: { features: Set<Feature> | null; email: string | null },
): Headers {
  headers.delete(FEATURES_HEADER);
  headers.delete(EMAIL_HEADER);
  headers.delete("x-user-plan"); // 以前の仕組みの名残。念のため消しておく
  if (values.features) headers.set(FEATURES_HEADER, [...values.features].sort().join(","));
  if (values.email) headers.set(EMAIL_HEADER, values.email);
  return headers;
}

/** 画面側で x-user-features を読む。想定外の値は無視する */
export function parseFeaturesHeader(value: string | null): Set<Feature> {
  return new Set((value ?? "").split(",").map((v) => v.trim()).filter(isFeature));
}
