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

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (!isValidStatus(body.status)) {
    return Response.json(
      { error: "status は pending または copied を指定してください。" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("visit_records")
    .update({ status: body.status })
    .eq("id", id);

  if (error) {
    console.error("Failed to update visit_records:", error);
    return Response.json({ error: "ステータスの更新に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
