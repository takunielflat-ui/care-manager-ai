import { requireFeature } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await requireFeature("fifth_sheet");
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { error } = await supabase.from("known_names").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete known_names:", error);
    return Response.json({ error: "辞書からの削除に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
