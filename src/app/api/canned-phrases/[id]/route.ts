import { createClient } from "@/lib/supabase/server";

const MAX_BODY_LENGTH = 500;

function isValidSortOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { body?: unknown; sortOrder?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const updates: { body?: string; sort_order?: number } = {};

  if (body.body !== undefined) {
    const phraseBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!phraseBody) {
      return Response.json({ error: "本文を入力してください。" }, { status: 400 });
    }
    if (phraseBody.length > MAX_BODY_LENGTH) {
      return Response.json(
        { error: `本文は${MAX_BODY_LENGTH}文字以内で入力してください。` },
        { status: 400 },
      );
    }
    updates.body = phraseBody;
  }

  if (body.sortOrder !== undefined) {
    if (!isValidSortOrder(body.sortOrder)) {
      return Response.json({ error: "並び順は整数で指定してください。" }, { status: 400 });
    }
    updates.sort_order = body.sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "更新する項目がありません。" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("canned_phrases")
    .update(updates)
    .eq("id", id)
    .select("id, body, sort_order, created_at")
    .single();

  if (error) {
    console.error("Failed to update canned_phrases:", error);
    return Response.json({ error: "定型文の更新に失敗しました。" }, { status: 500 });
  }

  return Response.json({ cannedPhrase: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { error } = await supabase.from("canned_phrases").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete canned_phrases:", error);
    return Response.json({ error: "定型文の削除に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
