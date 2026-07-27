import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたは経験豊富な介護支援専門員（ケアマネジャー）です。
訪問時の走り書きメモを、居宅介護支援経過（第5表）に記載できる専門的な文章へ整えてください。

## 出力形式
以下の見出しを持つプレーンテキストで出力してください。Markdownの記号（#, *, -）は使わないでください。

【訪問日】
【利用者】
【内容】
【所見・アセスメント】
【対応・今後の方針】

## 記載のルール
- 「である調」で、簡潔かつ客観的な事実記録として記載する。
- 本人・家族の発言は「」で囲み、可能な限り原文のニュアンスを残す。
- メモに書かれていない事実を推測で補ってはならない。情報が不足している項目には「記載なし」と書く。
- 主観的な評価語（「良い」「悪い」など）は避け、観察された事実で表現する。
- 【所見・アセスメント】はメモの記述から読み取れる範囲の専門的評価にとどめる。
- 個人が特定される情報は、渡された表示名以外は使わない。`;

export async function POST(request: Request) {
  let body: { visitDate?: string; displayName?: string; note?: string };

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

  try {
    const message = await client.messages.create({
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
    });

    // 安全側の判定：拒否された場合 content は空、または途中で切れている
    if (message.stop_reason === "refusal") {
      return Response.json(
        { error: "この内容はAIが生成を見送りました。記載内容をご確認ください。" },
        { status: 422 },
      );
    }

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return Response.json(
        { error: "AIから本文が返りませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    return Response.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "アクセスが集中しています。少し待ってからお試しください。" },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "APIキーが正しくありません。設定を確認してください。" },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return Response.json(
        { error: "AIサービスに接続できませんでした。通信環境をご確認ください。" },
        { status: 503 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", error.status, error.message);
      return Response.json(
        { error: "AIの処理中にエラーが発生しました。もう一度お試しください。" },
        { status: 502 },
      );
    }
    console.error("Unexpected error in /api/generate:", error);
    return Response.json(
      { error: "予期しないエラーが発生しました。" },
      { status: 500 },
    );
  }
}
