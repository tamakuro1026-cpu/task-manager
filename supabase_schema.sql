create table public.tasks (
  id          text primary key,
  title       text not null,
  category    text not null,
  start_date  date,
  due_date    date,
  completed   boolean not null default false,
  created_at  bigint not null
);

-- 全ユーザーが読み書き可能（認証なし運用の場合）
alter table public.tasks enable row level security;

create policy "allow all" on public.tasks
  for all using (true) with check (true);

-- リアルタイム配信を有効化
alter publication supabase_realtime add table public.tasks;
