import { createClient } from "@/lib/supabase/server";

const MAX_IDS = 200;

function isIdArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_IDS &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

/** 一括削除の「元に戻す」用。deleted_at を null に戻す。 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (!isIdArray(body.ids)) {
    return Response.json(
      { error: `復元する記録を指定してください（最大${MAX_IDS}件）。` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("visit_records")
    .update({ deleted_at: null })
    .in("id", body.ids)
    .not("deleted_at", "is", null);

  if (error) {
    console.error("Failed to bulk-restore visit_records:", error);
    return Response.json({ error: "記録の復元に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
