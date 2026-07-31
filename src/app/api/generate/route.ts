import Anthropic from "@anthropic-ai/sdk";

import {
  buildFifthSheetUserMessage,
  FIFTH_SHEET_SYSTEM_PROMPT,
} from "@/prompts/fifthSheetPrompt";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

type ClientPayload = {
  visitDate?: string;
  displayName?: string;
  note?: string;
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
            model: "claude-opus-5",
            max_tokens: 16000,
            output_config: { effort: "medium" },
            // システムプロンプトはリクエスト間で不変なのでキャッシュさせる。
            // 2回目以降は前置き処理が短くなり、初動が早くなる。
            system: [
              {
                type: "text",
                text: FIFTH_SHEET_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              {
                role: "user",
                content: buildFifthSheetUserMessage({
                  visitDate,
                  displayName,
                  note,
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
          `[generate] in=${usage.input_tokens} out=${usage.output_tokens} ` +
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
