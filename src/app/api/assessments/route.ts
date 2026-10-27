import { parseAssessmentPayload } from "@/lib/assessment/payload";
import { requireMember } from "./_lib";

/** アセスメントを新しく保存する。AI は使わない */
export async function POST(request: Request) {
  const auth = await requireMember();
  if (auth instanceof Response) return auth;
  const { supabase, userId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = parseAssessmentPayload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({ ...parsed.row, user_id: userId })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert assessments:", error);
    return Response.json({ error: "アセスメントの保存に失敗しました。" }, { status: 500 });
  }

  return Response.json({ id: data.id }, { status: 201 });
}
