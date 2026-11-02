import { requireFeature } from "@/lib/api-auth";

type CreateRecordPayload = {
  visitDate?: string;
  displayName?: string;
  note?: string;
  generatedText?: string;
};

export async function POST(request: Request) {
  // 権限の確認とボディのパースは互いに依存しないので、並行に行って保存の体感速度を上げる。
  const [auth, parsedBody] = await Promise.all([
    requireFeature("fifth_sheet"),
    request.json().catch(() => null),
  ]);

  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  if (parsedBody === null) {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  const body: CreateRecordPayload = parsedBody;

  const visitDate = body.visitDate?.trim() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const note = body.note?.trim() ?? "";
  const generatedText = body.generatedText?.trim() ?? "";

  if (!visitDate || !displayName || !note || !generatedText) {
    return Response.json(
      { error: "訪問日・利用者表示名・訪問メモ・生成結果をすべて指定してください。" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("visit_records")
    .insert({
      user_id: user.id,
      visit_date: visitDate,
      display_name: displayName,
      note,
      generated_text: generatedText,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert visit_records:", error);
    return Response.json({ error: "記録の保存に失敗しました。" }, { status: 500 });
  }

  return Response.json({ id: data.id }, { status: 201 });
}
