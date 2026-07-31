import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("known_names").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete known_names:", error);
    return Response.json({ error: "辞書からの削除に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
