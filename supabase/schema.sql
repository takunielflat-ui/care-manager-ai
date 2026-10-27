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

-- care-manager-ai: visit_records への論理削除（deleted_at）追加
-- 第5表は開示請求・運営指導の対象になる記録のため、一覧からの一括削除は
-- 物理削除ではなく deleted_at を立てるだけの論理削除にする。
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

alter table public.visit_records
  add column if not exists deleted_at timestamptz;

-- 一覧は常に deleted_at is null で絞り込むため、その形での検索を高速化する。
create index if not exists visit_records_user_created_active_idx
  on public.visit_records (user_id, created_at desc)
  where deleted_at is null;

-- RLS ポリシーは user_id ベースのままで deleted_at の影響を受けないため変更不要。

-- care-manager-ai: allowed_emails テーブルとRLSポリシー
-- 無料モニター期間中、アプリを使えるメールアドレスの一覧。URLを知っていれば誰でも
-- 登録できてしまうため、ここに登録した人だけが記録の作成（Anthropic APIの課金）を使える
-- （判定は src/lib/access.ts、振り分けは src/proxy.ts）。
-- UNLIMITED_GENERATION_EMAILS の運営者アドレスは、ここに無くても常に使える。
-- 行の追加・削除は Supabase の Table Editor から行う。
--   email      … 小文字で入れる（大文字小文字は区別せずに照合する）
--   expires_at … 利用期限。空欄なら無期限、過ぎると使えなくなる
--   note       … メモ（Threadsのアカウント名など。任意）
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

create table public.allowed_emails (
  email text primary key,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

-- 自分のメールアドレスの行だけ読める（他の人が登録されているかは分からない）。
-- 追加・変更・削除のポリシーは作らない＝アプリからは書き込めず、運営者がTable Editorで管理する。
create policy "select own allowed_email"
  on public.allowed_emails for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- この仕組みを入れる前から使っている人は、締め出さないよう無期限で登録しておく
insert into public.allowed_emails (email, note)
select lower(email), '既存ユーザー'
from auth.users
where email is not null
on conflict (email) do nothing;

-- care-manager-ai: assessments テーブルとRLSポリシー
-- 選択式アセスメント（/assessment）の保存。AIは使わない。
-- 文章（generated_text）は保存時点のものを残す。テンプレートの文言をあとで直しても
-- 保存済みの文章は変わらない。selections / family は開き直して編集するために残す。
-- アセスメントも運営指導の対象になりうる記録のため、削除は deleted_at を立てる論理削除のみ。
-- 物理削除のポリシーは作らない（アプリからは本当に消せない）。
-- 既に他のテーブルを作成済みの場合は、この部分だけを追加実行すればよい。

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  assessed_on date not null,
  family jsonb not null default '[]'::jsonb,
  selections jsonb not null default '{}'::jsonb,
  include_unconfirmed boolean not null default true,
  generated_text text not null,
  template_version integer not null,
  unconfirmed_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 一覧は常に deleted_at is null で、実施日の新しい順に出す
create index assessments_user_assessed_active_idx
  on public.assessments (user_id, assessed_on desc, created_at desc)
  where deleted_at is null;

create trigger set_assessments_updated_at
  before update on public.assessments
  for each row
  execute function public.set_updated_at();

alter table public.assessments enable row level security;

create policy "select own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

create policy "insert own assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

create policy "update own assessments"
  on public.assessments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
