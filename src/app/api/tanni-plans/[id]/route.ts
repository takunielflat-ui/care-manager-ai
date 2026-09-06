import { createClient } from "@/lib/supabase/server";

export async function GET(
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

  const { data, error } = await supabase
    .from("tanni_plans")
    .select("id, title, state, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    return Response.json({ error: "プランが見つかりません。" }, { status: 404 });
  }

  return Response.json({ plan: data });
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

  const { error } = await supabase.from("tanni_plans").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete tanni_plans:", error);
    return Response.json({ error: "プランの削除に失敗しました。" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
