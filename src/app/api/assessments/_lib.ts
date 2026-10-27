import { hasAppAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * アセスメントの API 共通の確認。ログインしていて、モニターとして許可された人だけ通す。
 * /api/* は proxy.ts の対象外なので、ここで画面と同じ条件（ログイン必須・モニター限定）にそろえる。
 * 通れば { supabase, userId }、通らなければそのまま返す Response。
 */
export async function requireMember(): Promise<{ supabase: Supabase; userId: string } | Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  if (!(await hasAppAccess(supabase, user.email))) {
    return Response.json({ error: "現在は無料モニターの方だけがご利用いただけます。" }, { status: 403 });
  }
  return { supabase, userId: user.id };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL の id が UUID の形か（形の違う id で DB エラーにしない） */
export const isUuid = (value: string) => UUID.test(value);
