import { createClient } from "@/lib/supabase/server";

const MAX_TITLE_LENGTH = 100;

function isValidState(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
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
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch tanni_plans:", error);
    return Response.json({ error: "保存済みプランの取得に失敗しました。" }, { status: 500 });
  }

  return Response.json({ plans: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { title?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return Response.json(
      { error: `プラン名を${MAX_TITLE_LENGTH}文字以内で指定してください。` },
      { status: 400 },
    );
  }

  if (!isValidState(body.state)) {
    return Response.json({ error: "保存する内容が不正です。" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tanni_plans")
    .insert({ user_id: user.id, title, state: body.state })
    .select("id, title, updated_at")
    .single();

  if (error) {
    console.error("Failed to insert tanni_plans:", error);
    return Response.json({ error: "プランの保存に失敗しました。" }, { status: 500 });
  }

  return Response.json({ plan: data }, { status: 201 });
}
