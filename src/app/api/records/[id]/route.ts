import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["pending", "copied"] as const;
type RecordStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: unknown): value is RecordStatus {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);
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

  let body: { status?: unknown; generatedText?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const updates: { status?: RecordStatus; generated_text?: string } = {};

  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return Response.json(
        { error: "status は pending または copied を指定してください。" },
        { status: 400 },
      );
    }
    updates.status = body.status;
  }

  if (body.generatedText !== undefined) {
    if (typeof body.generatedText !== "string" || body.generatedText.trim() === "") {
      return Response.json({ error: "生成結果を入力してください。" }, { status: 400 });
    }
    updates.generated_text = body.generatedText.trim();
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "更新する項目がありません。" }, { status: 400 });
  }

  const { error } = await supabase.from("visit_records").update(updates).eq("id", id);

  if (error) {
    console.error("Failed to update visit_records:", error);
    return Response.json({ error: "記録の更新に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
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

  const { error } = await supabase.from("visit_records").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete visit_records:", error);
    return Response.json({ error: "記録の削除に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
