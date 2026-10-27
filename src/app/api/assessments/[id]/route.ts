import { parseAssessmentPayload } from "@/lib/assessment/payload";
import { isUuid, requireMember } from "../_lib";

const NOT_FOUND = () =>
  Response.json({ error: "アセスメントが見つかりません。" }, { status: 404 });

/** 保存済みのアセスメントを上書きする（文章は選んだ内容から作り直す） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();

  const auth = await requireMember();
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsed = parseAssessmentPayload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // RLS で自分の行しか更新できない。削除済みのものは更新しない
  const { data, error } = await supabase
    .from("assessments")
    .update(parsed.row)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("Failed to update assessments:", error);
    return Response.json({ error: "アセスメントの保存に失敗しました。" }, { status: 500 });
  }
  if (!data || data.length === 0) return NOT_FOUND();

  return Response.json({ ok: true });
}

/** アセスメントを削除する（論理削除。運営指導の対象になりうる記録のため、本当には消さない） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();

  const auth = await requireMember();
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("assessments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("Failed to delete assessments:", error);
    return Response.json({ error: "アセスメントの削除に失敗しました。" }, { status: 500 });
  }
  if (!data || data.length === 0) return NOT_FOUND();

  return Response.json({ ok: true });
}
