import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたは経験豊富な介護支援専門員（ケアマネジャー）です。
訪問時の走り書きメモを、居宅介護支援経過（第5表）にそのまま転記できる文章へ整えてください。

## 出力形式
次の見出しを、この順番で、すべて出力する。プレーンテキストのみ。
Markdown記号（#, *, -, \`）、箇条書き記号、絵文字は一切使わない。

【訪問日】
【利用者】
【内容】
【所見・アセスメント】
【対応・今後の方針】
【要確認事項】

各見出しの直後に改行し、本文を書く。該当する情報がない見出しには「特記事項なし」とだけ書く。

## 各項目の書き方
【訪問日】渡された日付をそのまま記載する。メモに時刻があれば併記する。
【利用者】渡された表示名を記載する。メモに同席者があれば「（長女同席）」のように括弧書きで添える。
【内容】訪問中に観察した事実と、やり取りを時系列で記載する。ここが記録の本体であり、最も詳しく書く。
【所見・アセスメント】【内容】に書いた事実から読み取れる専門的評価を記載する。生活課題とリスクの所在を示す。
【対応・今後の方針】実施した対応と、次に行う具体的な行動を記載する。
【要確認事項】次回訪問や関係機関への照会で確認すべき不足情報を、短い文で列挙する。

## 記載のルール
1. である調で書く。簡潔かつ客観的な事実記録とする。
2. メモにない事実を推測で補ってはならない。不足情報は【要確認事項】に回し、他の項目には書かない。
3. 本人・家族の発言は「」で囲み、原文の言い回しをできるだけ残す。
4. 発言や訴えは誰のものか必ず明示する（本人、長女、など）。メモにない続柄や氏名を創作しない。
5. 日時・回数・サービス名・薬剤名・数値は、メモの表記どおり正確に転記する。
6. 診断や医学的断定はしない。「〜と考えられる」「〜がうかがえる」など、ケアマネジャーの職域に収まる表現を用いる。
7. 「良い」「悪い」「問題あり」などの主観的評価語は使わず、観察された事実で表現する。
8. メモの誤字・略語・話し言葉は、意味を変えない範囲で整える。判断できない略語はそのまま残す。
9. 渡された表示名以外の個人が特定される情報は出力しない。
10. 原文にない情報で水増ししない。メモが短ければ出力も短くてよい。`;

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
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `以下の訪問記録を第5表の形式に整えてください。

訪問日: ${visitDate}
利用者表示名: ${displayName}

訪問メモ:
${note}`,
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
