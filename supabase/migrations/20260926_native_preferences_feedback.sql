-- Additive native preferences. Web profile fields and existing RLS remain intact.
alter table public.profiles
  add column if not exists native_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(native_preferences) = 'object' and octet_length(native_preferences::text) <= 4096);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('issue', 'idea', 'question')),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  app_version text not null check (char_length(app_version) <= 80),
  locale text not null check (char_length(locale) <= 80),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);
create index feedback_user_created_idx on public.feedback(user_id, created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (id, user_id, kind, message, app_version, locale) on public.feedback to authenticated;
create policy feedback_read_own on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
comment on table public.feedback is 'User-submitted support and product feedback. No tokens, trips or diagnostics are sent automatically.';
