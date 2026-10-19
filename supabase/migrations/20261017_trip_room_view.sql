-- What the web Trip Room shows to anyone holding a trip's link (the link is the invite, as in the app):
-- the plan, who's coming and the budget per person. Not shown: costs and who paid, votes, notes, links, or anything
-- private (documents, packing, wardrobe never reach the server's shared copy in the first place).
create or replace function public.view_shared_trip(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', t.trip ->> 'name',
    'destination', t.trip ->> 'destination',
    'start', t.trip ->> 'start',
    'end', t.trip ->> 'end',
    'theme', t.trip ->> 'theme',
    'currency', t.trip ->> 'currency',
    'budget', coalesce((t.trip ->> 'budget')::numeric, 0),
    'travellers', coalesce((t.trip ->> 'travellers')::int, 1),
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
  from public.shared_trips t where t.code = p_code
$$;
revoke all on function public.view_shared_trip(text) from public;
grant execute on function public.view_shared_trip(text) to anon, authenticated;
