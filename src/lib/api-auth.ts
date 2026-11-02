import type { User } from "@supabase/supabase-js";

import { checkFeature, type Feature } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * API の入口で使う共通の確認。ログインしていて、その機能の権限が今あるかを毎回データベースで確かめる。
 * /api/* は proxy.ts の対象外なので、画面の振り分けとは別にここで止める。
 * リクエストのヘッダー（x-user-features など）は見ない。
 *
 * 通れば { supabase, user }、通らなければそのまま返す Response（401 / 403）。
 */
export async function requireFeature(feature: Feature): Promise<{ supabase: Supabase; user: User } | Response> {
  const supabase = await createClient();
  const result = await checkFeature(supabase, feature);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return { supabase, user: result.user };
}
