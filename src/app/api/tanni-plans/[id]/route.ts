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

/** 上書き保存。中身（state）だけを差し替える。プラン名は変えない */
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

  let body: { state?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const raw = body.state;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return Response.json({ error: "保存する内容が不正です。" }, { status: 400 });
  }

  // 利用者の実名（PDF用の印刷名）はサーバーに残さない
  const { 印刷名: _除外, ...state } = raw as Record<string, unknown>;
  void _除外;

  // RLS で自分の行しか更新できない。更新できた行がなければ「見つからない」として返す
  const { data, error } = await supabase
    .from("tanni_plans")
    .update({ state })
    .eq("id", id)
    .select("id, title, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Failed to update tanni_plans:", error);
    return Response.json({ error: "上書き保存に失敗しました。" }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "上書きできませんでした。計算が削除されているか、上書きの準備（データベースの設定）がまだの可能性があります。" },
      { status: 404 },
    );
  }

  return Response.json({ plan: data });
}
