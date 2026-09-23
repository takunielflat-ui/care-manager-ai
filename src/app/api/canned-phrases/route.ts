import { createClient } from "@/lib/supabase/server";

const MAX_CANNED_PHRASES = 20;
const MAX_BODY_LENGTH = 500;

function isValidSortOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
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
    .from("canned_phrases")
    .select("id, body, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch canned_phrases:", error);
    return Response.json({ error: "定型文の取得に失敗しました。" }, { status: 500 });
  }

  return Response.json({ cannedPhrases: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { body?: unknown; sortOrder?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const phraseBody = typeof body.body === "string" ? body.body.trim() : "";
  const sortOrder = isValidSortOrder(body.sortOrder) ? body.sortOrder : 0;

  if (!phraseBody) {
    return Response.json({ error: "本文を入力してください。" }, { status: 400 });
  }
  if (phraseBody.length > MAX_BODY_LENGTH) {
    return Response.json(
      { error: `本文は${MAX_BODY_LENGTH}文字以内で入力してください。` },
      { status: 400 },
    );
  }

  const { count, error: countError } = await supabase
    .from("canned_phrases")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Failed to count canned_phrases:", countError);
    return Response.json({ error: "定型文の登録に失敗しました。" }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_CANNED_PHRASES) {
    return Response.json(
      { error: `定型文は${MAX_CANNED_PHRASES}件まで登録できます。` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("canned_phrases")
    .insert({ user_id: user.id, body: phraseBody, sort_order: sortOrder })
    .select("id, body, sort_order, created_at")
    .single();

  if (error) {
    console.error("Failed to insert canned_phrases:", error);
    return Response.json({ error: "定型文の登録に失敗しました。" }, { status: 500 });
  }

  return Response.json({ cannedPhrase: data }, { status: 201 });
}
