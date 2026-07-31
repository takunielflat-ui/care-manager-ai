This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy the env template and set your Anthropic API key — the "第5表を作成" button
calls `/api/generate`, which needs it:

```bash
cp .env.example .env.local
# then edit .env.local and paste your key
```

### Supabaseのセットアップ（ログイン・記録保存に必要）

1. [Supabase](https://supabase.com) でプロジェクトを作成する。
2. Dashboard の SQL Editor で `supabase/schema.sql` の内容を実行する
   （`visit_records`・`known_names` テーブル、RLSポリシー、`updated_at` トリガーが作成される）。
3. Authentication > Sign In / Providers で **Email** を有効にする
   （パスワードは使わないので、そのままでよい）。
4. Authentication > Email Templates の「Magic Link」テンプレートを開き、
   本文に `{{ .Token }}` を含める。これがないとメールに6桁コードが載らず、
   ログイン画面のOTP入力が使えない。
5. Project Settings > API から `Project URL` と `anon public` キーを取得し、
   `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定する。

### AI送信時の匿名化

`/api/generate` はAIに送る直前に `src/lib/anonymize.ts` の `anonymizeForAI()` で
人名・病院名・施設名・地名をプレースホルダーに置換する（正規表現ベース、フォーム・DB・
一覧画面の実名表示には影響しない）。

「〜病院」「〜デイサービス」「〜市」のように種別語が付く固有名詞は自動で拾えるが、
「あいの郷」のように種別語が付かない固有名詞は拾えない。その場合はログイン後に
`/settings`（辞書設定）画面から個別に登録する。登録内容はSupabaseの `known_names`
テーブルにユーザーごと（RLSで分離）に保存され、他のアカウントには影響しない。

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
