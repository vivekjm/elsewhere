-- Planning's AI: a cap on all accounts together per UTC day, on top of each account's own allowance, so new
-- accounts can't be used to run up the AI bill. Only counts are kept, never content.
create index if not exists ai_usage_day_idx on public.ai_usage (day);

-- Replaces the one-argument version (two would make PostgREST calls ambiguous); calls with only p_limit still work.
drop function if exists public.use_ai_quota(integer);

-- Counts one call for the signed-in user. True when it's within their allowance (p_limit) and, when p_global is
-- given, within everyone's total for today. A call refused by the global cap isn't counted against the person.
create or replace function public.use_ai_quota(p_limit integer default 40, p_global integer default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  n integer;
begin
  if uid is null then return false; end if;
  if p_global is not null and (select coalesce(sum(calls), 0) from public.ai_usage where day = today) >= greatest(1, p_global) then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, calls) values (uid, today, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return n <= greatest(1, least(coalesce(p_limit, 40), 500));
end;
$$;

-- Signed-in users only.
revoke all on function public.use_ai_quota(integer, integer) from public, anon;
grant execute on function public.use_ai_quota(integer, integer) to authenticated;
