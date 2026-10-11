-- Per-trip details from the native iOS app that the shared web workspace
-- doesn't model: trip type, route stages, gear, safety check-ins, expenses,
-- shared-trip votes and balances. One row per user and trip, owner-only.
create table public.trip_extras (
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id text not null check (char_length(trip_id) between 1 and 100),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, trip_id)
);

alter table public.trip_extras enable row level security;
grant select, insert, update, delete on public.trip_extras to authenticated;

create policy "Users can view their own trip extras"
  on public.trip_extras for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own trip extras"
  on public.trip_extras for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own trip extras"
  on public.trip_extras for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own trip extras"
  on public.trip_extras for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger trip_extras_updated_at
before update on public.trip_extras
for each row execute function public.touch_trips_loom_profile();
