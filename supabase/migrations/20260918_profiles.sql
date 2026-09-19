create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  home_base text not null default '',
  travel_style text not null default 'a little of everything',
  interests text[] not null default '{}'::text[],
  packing_style text not null default 'light and considered',
  unit text not null default 'metric' check (unit in ('metric', 'imperial')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

create policy "Users can view their own Trips Loom profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own Trips Loom profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own Trips Loom profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.touch_trips_loom_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.touch_trips_loom_profile();

create or replace function public.create_trips_loom_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.create_trips_loom_profile();
