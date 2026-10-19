-- Product analytics owned by Trips Loom: named events from the apps, no trip content.
-- Insert-only for signed-in users (their own rows); nobody can read them back through the API.
create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,47}$'),
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024),
  session_id text not null check (char_length(session_id) between 8 and 64),
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text not null default '' check (char_length(app_version) <= 40),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index app_events_name_time_idx on public.app_events (name, occurred_at desc);
create index app_events_user_time_idx on public.app_events (user_id, occurred_at desc);

alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;
grant insert (name, props, session_id, platform, app_version, occurred_at) on public.app_events to authenticated;
create policy app_events_insert_own on public.app_events for insert to authenticated
  with check ((select auth.uid()) = user_id and occurred_at > now() - interval '7 days' and occurred_at < now() + interval '1 hour');
comment on table public.app_events is 'Anonymous-content product events (name plus small enum-like props). Read only by the service role for funnels.';
