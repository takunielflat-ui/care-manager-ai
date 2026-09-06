import Anthropic from "@anthropic-ai/sdk";

import {
  buildFifthSheetUserMessage,
  getFifthSheetSystemPrompt,
} from "@/prompts/fifthSheetPrompt";
import { createClient } from "@/lib/supabase/server";
import { anonymizeForAI, EMPTY_KNOWN_NAMES, type Category, type KnownNames } from "@/lib/anonymize";
import type { GenerationMode } from "@/lib/generationMode";
import type { SupabaseClient } from "@supabase/supabase-js";

const client = new Anthropic();

// 無料モニター期間の使い込み対策。Anthropic APIを呼ぶ＝課金が発生するため、
// 1ユーザーあたり1日の作成回数に上限を設ける。
const DAILY_GENERATION_LIMIT = 10;

/** UNLIMITED_GENERATION_EMAILS（カンマ区切り）に含まれるメールアドレスは上限の対象外にする */
function isUnlimitedEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.UNLIMITED_GENERATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/** 日本時間の「今日の0時」をUTCのISO文字列で返す（generation_logのcreated_at比較用） */
function startOfTodayInJapan(): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T00:00:00+09:00`;
}

/**
 * 本日の作成回数が上限に達していないか確認し、達していなければ今回の分を記録する。
 * 上限に達していれば、そのままクライアントへ返すエラーレスポンスを返す。
 */
async function checkAndRecordGenerationLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<Response | null> {
  const { count, error: countError } = await supabase
    .from("generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayInJapan());

  if (countError) {
    console.error("Failed to count generation_log:", countError);
    // 集計に失敗しても生成自体は止めない（上限管理より機能提供を優先）
  } else if ((count ?? 0) >= DAILY_GENERATION_LIMIT) {
    return Response.json(
      {
        error: `本日の作成回数の上限（${DAILY_GENERATION_LIMIT}回）に達しました。日付が変わると再度ご利用いただけます。`,
      },
      { status: 429 },
    );
  }

  const { error: insertError } = await supabase.from("generation_log").insert({ user_id: userId });
  if (insertError) {
    console.error("Failed to insert generation_log:", insertError);
  }

  return null;
}

type ClientPayload = {
  visitDate?: string;
  displayName?: string;
  note?: string;
  mode?: string;
};

/** 想定内の失敗を、利用者に見せる日本語メッセージへ変換する。 */
function toUserMessage(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) {
    return "アクセスが集中しています。少し待ってからお試しください。";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "APIキーが正しくありません。設定を確認してください。";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "AIサービスに接続できませんでした。通信環境をご確認ください。";
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error:", error.status, error.message);
    return "AIの処理中にエラーが発生しました。もう一度お試しください。";
  }
  console.error("Unexpected error in /api/generate:", error);
  return "予期しないエラーが発生しました。";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: ClientPayload;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const visitDate = body.visitDate?.trim() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const note = body.note?.trim() ?? "";
  // 不正・未指定な値は「簡潔」にフォールバックする（デフォルトモード）。
  const mode: GenerationMode = body.mode === "detailed" ? "detailed" : "concise";

  if (!visitDate || !displayName || !note) {
    return Response.json(
      { error: "訪問日・利用者表示名・訪問メモをすべて入力してください。" },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "サーバーに ANTHROPIC_API_KEY が設定されていません。" },
      { status: 500 },
    );
  }

  if (!isUnlimitedEmail(user.email)) {
    const limitError = await checkAndRecordGenerationLimit(supabase, user.id);
    if (limitError) return limitError;
  }

  // ユーザーごとの匿名化辞書（語尾のない固有名詞）を取得する。RLSにより自分の分だけ返る。
  const { data: knownNameRows, error: knownNamesError } = await supabase
    .from("known_names")
    .select("category, name");

  if (knownNamesError) {
    console.error("Failed to fetch known_names:", knownNamesError);
  }

  const knownNames: KnownNames = knownNameRows
    ? knownNameRows.reduce((acc, row) => {
        acc[row.category as Category].push(row.name);
        return acc;
      }, structuredClone(EMPTY_KNOWN_NAMES))
    : EMPTY_KNOWN_NAMES;

  // AIには実名を渡さない。保存・表示用の displayName/note はここでは書き換えない。
  const anonymized = anonymizeForAI({ displayName, note }, knownNames);

  const encoder = new TextEncoder();

  // NDJSON で流す。ヘッダ送出後はステータスを変えられないため、
  // 途中で起きた失敗も本文中の error 行として伝える。
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (line: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        } catch {
          closed = true; // クライアントが切断した
        }
      };

      try {
        const messageStream = client.messages.stream(
          {
            model: "claude-sonnet-5",
            max_tokens: 16000,
            output_config: { effort: "medium" },
            // システムプロンプトはモードごとに不変なのでキャッシュさせる。
            // 同じモードの2回目以降は前置き処理が短くなり、初動が早くなる。
            system: [
              {
                type: "text",
                text: getFifthSheetSystemPrompt(mode),
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              {
                role: "user",
                content: buildFifthSheetUserMessage({
                  visitDate,
                  displayName: anonymized.displayName,
                  note: anonymized.note,
                }),
              },
            ],
          },
          { signal: request.signal },
        );

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "delta", text: event.delta.text });
          }
        }

        const final = await messageStream.finalMessage();

        // キャッシュが効いているかを運用中に確認できるようにする（本文は出さない）
        const { usage } = final;
        console.log(
          `[generate] mode=${mode} in=${usage.input_tokens} out=${usage.output_tokens} ` +
            `cacheWrite=${usage.cache_creation_input_tokens ?? 0} ` +
            `cacheRead=${usage.cache_read_input_tokens ?? 0} stop=${final.stop_reason}`,
        );

        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message: "この内容はAIが生成を見送りました。記載内容をご確認ください。",
          });
        } else if (final.stop_reason === "max_tokens") {
          send({
            type: "error",
            message: "出力が長すぎて途中で終了しました。メモを分割してお試しください。",
          });
        } else {
          send({ type: "done" });
        }
      } catch (error) {
        // クライアント側の中断はエラーではない
        if (!request.signal.aborted) {
          send({ type: "error", message: toUserMessage(error) });
        }
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // リバースプロキシによるバッファリングを抑止する
      "X-Accel-Buffering": "no",
    },
  });
}
