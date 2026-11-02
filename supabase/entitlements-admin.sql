-- =====================================================================
--  care-manager-ai: 権限（user_entitlements）の手動管理用SQL
-- ---------------------------------------------------------------------
--  Supabase の SQL Editor に貼り、必要な部分だけを選んで実行する。
--  SQL Editor の「Save」で保存しておけば、次からはメールアドレスを書き換えるだけで使える。
--  ★付与できるのは、本人が一度ログインしてアカウントができている人だけ。
-- =====================================================================


-- ① アセスメントを付与する（購入された人）
--    書き換えるのは 'buyer@example.com' と 'Stripe 2026-11-xx' の2か所だけ。
--    結果に1行出れば完了。0行なら、その人はまだ一度もログインしていない
--    （「このアドレスで一度ログインしてください」と案内してから、もう一度実行する）。
--    すでに付与済みなら、何も変わらず0行になる。

insert into public.user_entitlements (user_id, feature, source, note)
select id, 'assessment', 'purchase', 'Stripe 2026-11-xx'
from auth.users
where lower(email) = lower('buyer@example.com')
on conflict (user_id, feature) do nothing
returning *;


-- ② 付与した人の一覧（新しい順）

select u.email, e.feature, e.source, e.granted_at, e.expires_at, e.note
from public.user_entitlements e
join auth.users u on u.id = e.user_id
order by e.granted_at desc;


-- ③ 取り消す（返金など）
--    書き換えるのは 'buyer@example.com' だけ。消した行が結果に出る。

delete from public.user_entitlements
where feature = 'assessment'
  and user_id = (select id from auth.users where lower(email) = lower('buyer@example.com'))
returning *;
