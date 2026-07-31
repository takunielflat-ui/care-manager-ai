import { createBrowserClient } from "@supabase/ssr";

/** クライアントコンポーネントから使うSupabaseクライアント。呼び出しごとに新規作成する。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
