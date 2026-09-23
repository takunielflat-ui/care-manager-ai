-- care-manager-ai: visit_records テーブルとRLSポリシー
-- Supabase Dashboard の SQL Editor で一度だけ実行してください。

create table public.visit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null,
  display_name text not null,
  note text not null,
  generated_text text not null,
  status text not null default 'pending' check (status in ('pending', 'copied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visit_records_user_created_idx
  on public.visit_records (user_id, created_at desc);

-- updated_at の自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_visit_records_updated_at
  before update on public.visit_records
  for each row
  execute function public.set_updated_at();

-- RLS: ユーザーは自分のレコードのみ参照・作成・更新できる
alter table public.visit_records enable row level security;

create policy "select own records"
  on public.visit_records for select
  using (auth.uid() = user_id);

create policy "insert own records"
  on public.visit_records for insert
  with check (auth.uid() = user_id);

create policy "update own records"
  on public.visit_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own records"
  on public.visit_records for delete
  using (auth.uid() = user_id);

-- care-manager-ai: known_names テーブルとRLSポリシー
-- AI送信時の匿名化（src/lib/anonymize.ts）で使う、語尾のない固有名詞の辞書。
-- 既に visit_records を作成済みの場合は、この部分だけを追加実行すればよい。

create table public.known_names (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('person', 'hospital', 'facility', 'place')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, category, name)
);

create index known_names_user_idx
  on public.known_names (user_id);

alter table public.known_names enable row level security;

create policy "select own known_names"
  on public.known_names for select
  using (auth.uid() = user_id);

create policy "insert own known_names"
  on public.known_names for insert
  with check (auth.uid() = user_id);

create policy "delete own known_names"
  on public.known_names for delete
  using (auth.uid() = user_id);

-- care-manager-ai: tanni_plans テーブルとRLSポリシー
-- 単位数シミュレーター（/tools/tanni）の「保存」機能で使う。
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

create table public.tanni_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tanni_plans_user_updated_idx
  on public.tanni_plans (user_id, updated_at desc);

create trigger set_tanni_plans_updated_at
  before update on public.tanni_plans
  for each row
  execute function public.set_updated_at();

alter table public.tanni_plans enable row level security;

create policy "select own tanni_plans"
  on public.tanni_plans for select
  using (auth.uid() = user_id);

create policy "insert own tanni_plans"
  on public.tanni_plans for insert
  with check (auth.uid() = user_id);

create policy "delete own tanni_plans"
  on public.tanni_plans for delete
  using (auth.uid() = user_id);

-- care-manager-ai: generation_log テーブルとRLSポリシー
-- /api/generate（Anthropic APIを呼ぶ＝課金が発生する処理）の1日あたりの
-- 利用回数を数えるための記録用テーブル。無料モニター期間の使い込み対策。
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

create table public.generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index generation_log_user_created_idx
  on public.generation_log (user_id, created_at desc);

alter table public.generation_log enable row level security;

create policy "select own generation_log"
  on public.generation_log for select
  using (auth.uid() = user_id);

create policy "insert own generation_log"
  on public.generation_log for insert
  with check (auth.uid() = user_id);

-- care-manager-ai: canned_phrases テーブルとRLSポリシー
-- 運営指導向けの定型文（例: 「自宅訪問し、本人と面談した」）をユーザーが自分で登録し、
-- 生成結果の末尾にチェックボックスで挿入するための辞書。AIには一切渡さない
-- （src/app/api/generate/route.ts はこのテーブルを参照しない）。
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

create table public.canned_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index canned_phrases_user_sort_idx
  on public.canned_phrases (user_id, sort_order, created_at);

alter table public.canned_phrases enable row level security;

create policy "select own canned_phrases"
  on public.canned_phrases for select
  using (auth.uid() = user_id);

create policy "insert own canned_phrases"
  on public.canned_phrases for insert
  with check (auth.uid() = user_id);

create policy "update own canned_phrases"
  on public.canned_phrases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own canned_phrases"
  on public.canned_phrases for delete
  using (auth.uid() = user_id);
