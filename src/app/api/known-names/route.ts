import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/anonymize";

const VALID_CATEGORIES = ["person", "hospital", "facility", "place"] as const;

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (VALID_CATEGORIES as readonly string[]).includes(value);
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
    .from("known_names")
    .select("id, category, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch known_names:", error);
    return Response.json({ error: "辞書の取得に失敗しました。" }, { status: 500 });
  }

  return Response.json({ knownNames: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { category?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!isValidCategory(body.category) || !name) {
    return Response.json(
      { error: "カテゴリと名称を指定してください。" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("known_names")
    .insert({ user_id: user.id, category: body.category, name })
    .select("id, category, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "すでに登録されています。" }, { status: 409 });
    }
    console.error("Failed to insert known_names:", error);
    return Response.json({ error: "辞書への追加に失敗しました。" }, { status: 500 });
  }

  return Response.json({ knownName: data }, { status: 201 });
}
