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
