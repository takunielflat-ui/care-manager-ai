import type { SupabaseClient } from "@supabase/supabase-js";

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
 * このユーザーがアプリ（第5表の作成など）を使ってよいかを判定する。
 * 無料モニター期間中は、運営者が allowed_emails に登録したメールアドレスだけを許可する。
 * URLを知っていれば誰でも登録できてしまうため、Anthropic APIの課金を無関係な人に
 * 使われないようにするのが目的。
 *
 * - UNLIMITED_GENERATION_EMAILS の運営者アドレスは、DBを見ずに常に許可する
 * - allowed_emails の expires_at が空なら無期限、過ぎていれば不許可
 * - 確認に失敗した場合は不許可にする（課金を伴うため、安全側に倒す）
 */
export async function hasAppAccess(
  supabase: SupabaseClient,
  email: string | undefined,
): Promise<boolean> {
  if (!email) return false;
  if (isUnlimitedEmail(email)) return true;

  // RLSにより、自分のメールアドレスの行だけが返る
  const { data, error } = await supabase
    .from("allowed_emails")
    .select("expires_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to check allowed_emails:", error);
    return false;
  }
  if (!data) return false;

  return data.expires_at === null || new Date(data.expires_at) > new Date();
}
