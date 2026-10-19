-- Group features on live trips: a read-only link for family, each member's travel preferences, and templates
-- ("do it again") that anyone with the link can copy into a trip of their own.

-- A second code that only views (the family view): it never joins.
alter table public.shared_trips add column if not exists view_code text unique check (view_code is null or view_code ~ '^[A-Za-z0-9]{10,16}$');

-- Each member's own preferences for the group (budget style, food, pace). Own-row update like rsvp.
alter table public.shared_trip_members add column if not exists prefs jsonb not null default '{}'::jsonb
  check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 1024);
grant update (prefs) on public.shared_trip_members to authenticated;

-- Organiser (or any member) makes / gets the family link.
create or replace function public.family_view_code(p_id text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  if not public.is_shared_trip_member(p_id) then raise exception 'You’re not on this trip.' using errcode = '42501'; end if;
  select view_code into v_code from public.shared_trips where id = p_id;
  if v_code is null then
    v_code := public.new_shared_trip_code();
    update public.shared_trips set view_code = v_code where id = p_id;
  end if;
  return v_code;
end;
$$;
revoke all on function public.family_view_code(text) from public, anon;
grant execute on function public.family_view_code(text) to authenticated;

-- The web page accepts either code; a view code can't be used to join (join_shared_trip only matches `code`).
create or replace function public.view_shared_trip(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', t.trip ->> 'name', 'destination', t.trip ->> 'destination', 'start', t.trip ->> 'start', 'end', t.trip ->> 'end',
    'theme', t.trip ->> 'theme', 'currency', t.trip ->> 'currency', 'budget', coalesce((t.trip ->> 'budget')::numeric, 0),
    'travellers', coalesce((t.trip ->> 'travellers')::int, 1), 'family', t.view_code = p_code,
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('date', a ->> 'date', 'time', a ->> 'time', 'title', a ->> 'title', 'place', a ->> 'place', 'category', a ->> 'category')
        order by a ->> 'date', coalesce(nullif(a ->> 'time', ''), '99'))
      from jsonb_array_elements(coalesce(t.trip -> 'activities', '[]'::jsonb)) a), '[]'::jsonb),
    'days', coalesce((select jsonb_object_agg(d.key, jsonb_build_object('title', d.value ->> 'title', 'stay', d.value ->> 'stay'))
      from jsonb_each(coalesce(t.trip -> 'days', '{}'::jsonb)) d), '{}'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', m.display_name, 'rsvp', m.rsvp, 'organiser', m.role = 'organiser') order by m.joined_at)
      from public.shared_trip_members m where m.trip_id = t.id), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(g ->> 'name') from jsonb_array_elements(coalesce(t.shared -> 'guests', '[]'::jsonb)) g), '[]'::jsonb)
  )
  from public.shared_trips t where t.code = p_code or t.view_code = p_code
$$;

-- Templates: a finished trip's plan with days counted from the start, copied by anyone with the link.
create table public.trip_templates (
  code text primary key check (code ~ '^[A-Za-z0-9]{10,16}$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author text not null check (char_length(btrim(author)) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  destination text not null default '' check (char_length(destination) <= 200),
  kind text not null default 'city' check (kind in ('city', 'beach', 'trek', 'road', 'dive')),
  theme text check (theme is null or char_length(theme) <= 40),
  days integer not null check (days between 1 and 60),
  people integer not null default 1 check (people between 1 and 100),
  per_person numeric not null default 0 check (per_person >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  plan jsonb not null check (jsonb_typeof(plan) = 'array' and octet_length(plan::text) <= 200000),
  forks integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.trip_templates enable row level security;
revoke all on public.trip_templates from anon, authenticated;
grant select on public.trip_templates to authenticated;
grant delete on public.trip_templates to authenticated;
create policy trip_templates_own on public.trip_templates for select to authenticated using ((select auth.uid()) = owner_id);
create policy trip_templates_delete_own on public.trip_templates for delete to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.publish_template(p_author text, p_name text, p_destination text, p_kind text, p_theme text, p_days integer,
  p_people integer, p_per_person numeric, p_currency text, p_plan jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text := public.new_shared_trip_code();
begin
  if auth.uid() is null then raise exception 'Sign in to share a template.' using errcode = '42501'; end if;
  insert into public.trip_templates (code, owner_id, author, name, destination, kind, theme, days, people, per_person, currency, plan)
  values (v_code, auth.uid(), left(btrim(p_author), 80), left(btrim(p_name), 200), left(p_destination, 200), p_kind, p_theme, p_days, p_people, greatest(0, p_per_person), p_currency, p_plan);
  return v_code;
end;
$$;

create or replace function public.get_template(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('code', code, 'author', author, 'name', name, 'destination', destination, 'kind', kind, 'theme', theme, 'days', days,
    'people', people, 'perPerson', per_person, 'currency', currency, 'plan', plan, 'forks', forks)
  from public.trip_templates where code = p_code
$$;

create or replace function public.count_template_fork(p_code text)
returns void language sql volatile security definer set search_path = ''
as $$ update public.trip_templates set forks = forks + 1 where code = p_code $$;

revoke all on function public.publish_template(text, text, text, text, text, integer, integer, numeric, text, jsonb), public.count_template_fork(text) from public, anon;
grant execute on function public.publish_template(text, text, text, text, text, integer, integer, numeric, text, jsonb), public.count_template_fork(text) to authenticated;
revoke all on function public.get_template(text) from public;
grant execute on function public.get_template(text) to anon, authenticated;
