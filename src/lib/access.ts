import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 使える機能の範囲。
 * - full       … すべての機能（第5表の作成＝Anthropic APIの課金を伴う機能を含む）。モニター・既存ユーザー
 * - assessment … アセスメントだけ（買い切りで購入した人）。AIは使わない
 */
export type AccessPlan = "full" | "assessment";

/** UNLIMITED_GENERATION_EMAILS（カンマ区切り）に含まれるメールアドレスは上限の対象外にする */
export function isUnlimitedEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.UNLIMITED_GENERATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * allowed_emails の1行から、使える範囲を決める。行がない・期限切れなら null（使えない）。
 * plan 列を追加する前のDB（列そのものがない）では、従来どおり full として扱う。
 * 想定外の値は使えない扱いにする（課金を伴う機能を誤って開放しないため）。
 */
export function toAccessPlan(
  row: { expires_at?: string | null; plan?: string | null } | null,
  now: Date = new Date(),
): AccessPlan | null {
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) <= now) return null;
  if (row.plan === undefined || row.plan === "full") return "full";
  if (row.plan === "assessment") return "assessment";
  return null;
}

/**
 * このユーザーが使える機能の範囲を返す。使えなければ null。
 * URLを知っていれば誰でも登録できてしまうため、運営者が allowed_emails に登録した
 * メールアドレスだけを許可する（Anthropic APIの課金を無関係な人に使われないようにする）。
 *
 * - UNLIMITED_GENERATION_EMAILS の運営者アドレスは、DBを見ずに常に full
 * - allowed_emails の expires_at が空なら無期限、過ぎていれば不許可
 * - 確認に失敗した場合は不許可にする（課金を伴うため、安全側に倒す）
 */
export async function getAccessPlan(
  supabase: SupabaseClient,
  email: string | undefined,
): Promise<AccessPlan | null> {
  if (!email) return null;
  if (isUnlimitedEmail(email)) return "full";

  // RLSにより、自分のメールアドレスの行だけが返る。
  // plan 列の追加前でも失敗しないよう、列名を指定せずに読む
  const { data, error } = await supabase.from("allowed_emails").select("*").limit(1).maybeSingle();

  if (error) {
    console.error("Failed to check allowed_emails:", error);
    return null;
  }
  return toAccessPlan(data);
}

/** アセスメントだけの人が開ける画面か（/assessment とその配下） */
export function isAssessmentPath(pathname: string) {
  return pathname === "/assessment" || pathname.startsWith("/assessment/");
}
