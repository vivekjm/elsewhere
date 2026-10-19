-- Plan mode's AI reading (/api/ai/reels) is paid per call: each signed-in account gets a daily allowance.
-- Counted per user per UTC day; no content is stored, only the count.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  calls integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- No policies: the table is only reached through use_ai_quota().

-- Counts one call for the signed-in user and says whether it's within today's allowance.
create or replace function public.use_ai_quota(p_limit integer default 40)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then return false; end if;
  insert into public.ai_usage (user_id, day, calls) values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return n <= greatest(1, least(coalesce(p_limit, 40), 500));
end;
$$;

revoke all on function public.use_ai_quota(integer) from public, anon;
grant execute on function public.use_ai_quota(integer) to authenticated;
