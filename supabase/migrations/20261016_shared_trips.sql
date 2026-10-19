-- Live shared trips: one trip that everyone on it edits, instead of a copy per person.
--
-- shared_trips holds the shared parts of a trip (the plan, and the group's costs, votes, date poll and guests).
-- Private things (wardrobe, packing ticks, documents, health check-ins) never leave each person's own workspace.
-- Access is by membership. Joining needs the trip's unguessable code, through join_shared_trip(), which also
-- lets the organiser revoke a link by rotating the code.

create table public.shared_trips (
  id text primary key check (char_length(id) between 1 and 100),
  code text not null unique check (code ~ '^[A-Za-z0-9]{10,16}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  trip jsonb not null check (jsonb_typeof(trip) = 'object' and octet_length(trip::text) <= 600000),
  shared jsonb not null default '{}'::jsonb check (jsonb_typeof(shared) = 'object' and octet_length(shared::text) <= 600000),
  version integer not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shared_trip_members (
  trip_id text not null references public.shared_trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role text not null default 'member' check (role in ('organiser', 'member')),
  rsvp text check (rsvp in ('in', 'maybe', 'out')),
  -- The member's own UPI ID, so others can pay them back. Only they can set it (own-row update policy).
  upi text check (upi is null or upi ~* '^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,32}$'),
  -- Their own readiness ticks for the organiser's Ready Check (booked, paid, id, packed…), not the documents.
  ready jsonb not null default '{}'::jsonb check (jsonb_typeof(ready) = 'object' and octet_length(ready::text) <= 4096),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index shared_trip_members_user_idx on public.shared_trip_members (user_id);

-- Membership check that policies can call without recursing through RLS.
create or replace function public.is_shared_trip_member(p_trip text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.shared_trip_members m where m.trip_id = p_trip and m.user_id = auth.uid()) $$;
revoke all on function public.is_shared_trip_member(text) from public, anon;
grant execute on function public.is_shared_trip_member(text) to authenticated;

alter table public.shared_trips enable row level security;
alter table public.shared_trip_members enable row level security;
revoke all on public.shared_trips, public.shared_trip_members from anon, authenticated;
grant select on public.shared_trips, public.shared_trip_members to authenticated;
grant update (display_name, rsvp, upi, ready, updated_at) on public.shared_trip_members to authenticated;
grant delete on public.shared_trip_members to authenticated;

create policy shared_trips_read on public.shared_trips for select to authenticated
  using (public.is_shared_trip_member(id));
create policy shared_trip_members_read on public.shared_trip_members for select to authenticated
  using (public.is_shared_trip_member(trip_id));
create policy shared_trip_members_update_own on public.shared_trip_members for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Leaving a trip (own row), or the organiser removing someone.
create policy shared_trip_members_delete on public.shared_trip_members for delete to authenticated
  using ((select auth.uid()) = user_id
    or exists (select 1 from public.shared_trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

create or replace function public.new_shared_trip_code()
returns text language sql volatile set search_path = ''
as $$ select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', 1 + floor(random() * 57)::int, 1), '')
      from generate_series(1, 12) $$;

-- Makes one of your trips live. Returns its code (an existing live trip keeps its code).
create or replace function public.share_trip_live(p_id text, p_trip jsonb, p_shared jsonb, p_name text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to share a trip.' using errcode = '42501'; end if;
  select code, owner_id into v_code, v_owner from public.shared_trips where id = p_id;
  if v_code is not null then
    if not public.is_shared_trip_member(p_id) then raise exception 'This trip belongs to someone else.' using errcode = '42501'; end if;
    return v_code;
  end if;
  v_code := public.new_shared_trip_code();
  insert into public.shared_trips (id, code, owner_id, trip, shared, updated_by) values (p_id, v_code, auth.uid(), p_trip, p_shared, auth.uid());
  insert into public.shared_trip_members (trip_id, user_id, display_name, role, rsvp) values (p_id, auth.uid(), left(btrim(p_name), 80), 'organiser', 'in');
  return v_code;
end;
$$;

-- What an invite shows before joining: enough to recognise the trip, nothing private.
create or replace function public.peek_shared_trip(p_code text)
returns table (id text, name text, destination text, start_date text, end_date text, organiser text, members integer, theme text)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.trip ->> 'name', t.trip ->> 'destination', t.trip ->> 'start', t.trip ->> 'end',
         (select m.display_name from public.shared_trip_members m where m.trip_id = t.id and m.role = 'organiser' limit 1),
         (select count(*)::int from public.shared_trip_members m where m.trip_id = t.id),
         t.trip ->> 'theme'
  from public.shared_trips t where t.code = p_code
$$;

-- Joins by code (idempotent). Returns the trip id.
create or replace function public.join_shared_trip(p_code text, p_name text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  if auth.uid() is null then raise exception 'Sign in to join a trip.' using errcode = '42501'; end if;
  select id into v_id from public.shared_trips where code = p_code;
  if v_id is null then raise exception 'This invite has expired or was turned off.' using errcode = 'P0002'; end if;
  if (select count(*) from public.shared_trip_members where trip_id = v_id) >= 50 then
    raise exception 'This trip is full.' using errcode = 'P0001';
  end if;
  insert into public.shared_trip_members (trip_id, user_id, display_name) values (v_id, auth.uid(), left(btrim(p_name), 80))
  on conflict (trip_id, user_id) do nothing;
  return v_id;
end;
$$;

-- Saves the shared parts if nobody else saved since `p_version`; returns the new version, or -1 on a conflict
-- (the app then fetches, merges and tries again).
create or replace function public.save_shared_trip(p_id text, p_version integer, p_trip jsonb, p_shared jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_version integer;
begin
  if not public.is_shared_trip_member(p_id) then raise exception 'You’re not on this trip.' using errcode = '42501'; end if;
  update public.shared_trips set trip = p_trip, shared = p_shared, version = version + 1, updated_by = auth.uid(), updated_at = now()
  where id = p_id and version = p_version
  returning version into v_version;
  return coalesce(v_version, -1);
end;
$$;

-- Organiser only: a new code, so the old link stops working.
create or replace function public.rotate_shared_trip_code(p_id text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  v_code := public.new_shared_trip_code();
  update public.shared_trips set code = v_code where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Only the organiser can change the link.' using errcode = '42501'; end if;
  return v_code;
end;
$$;

revoke all on function public.new_shared_trip_code() from public, anon, authenticated;
revoke all on function public.share_trip_live(text, jsonb, jsonb, text), public.join_shared_trip(text, text),
  public.save_shared_trip(text, integer, jsonb, jsonb), public.rotate_shared_trip_code(text) from public, anon;
grant execute on function public.share_trip_live(text, jsonb, jsonb, text), public.join_shared_trip(text, text),
  public.save_shared_trip(text, integer, jsonb, jsonb), public.rotate_shared_trip_code(text) to authenticated;
-- The web Trip Room shows the preview to people who haven't signed in yet.
revoke all on function public.peek_shared_trip(text) from public;
grant execute on function public.peek_shared_trip(text) to anon, authenticated;

create trigger shared_trip_members_updated_at before update on public.shared_trip_members
for each row execute function public.touch_trips_loom_profile();

-- Live updates where Realtime runs (the app also polls, so it works without it).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shared_trips, public.shared_trip_members;
  end if;
end $$;
