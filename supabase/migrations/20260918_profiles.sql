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

create policy "Users can view their own Elsewhere profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can create their own Elsewhere profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own Elsewhere profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.touch_elsewhere_profile()
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
for each row execute function public.touch_elsewhere_profile();
