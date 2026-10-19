-- ฟังแป๊บ: tables, row level security and grants.
--
-- Access model
--   * The browser only ever talks to the database through Next.js API routes, which call the
--     functions in 20261019000200_functions.sql with the player's own session.
--   * Tables that hold answers (daily_puzzles, song_previews) have RLS on and no policies,
--     so nobody can read them directly. Only SECURITY DEFINER functions touch them.
--   * Players can read their own rows. Every write goes through a function.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.artists (
  id bigint generated always as identity primary key,
  name text not null unique,
  aliases text[] not null default '{}'
);

create table public.songs (
  id bigint primary key, -- iTunes trackId
  title text not null,
  artist_id bigint not null references public.artists (id),
  category text not null check (category in ('pop', 'rock', 'luk', 'hiphop')),
  year smallint,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index songs_artist_id_idx on public.songs (artist_id);

-- Preview audio and artwork. Kept apart from songs so the public song list can't be used to
-- match today's audio URL back to a title.
create table public.song_previews (
  song_id bigint primary key references public.songs (id) on delete cascade,
  preview_url text not null,
  artwork_url text,
  track_url text,
  updated_at timestamptz not null default now()
);

-- The answer for each day and category tab, generated ahead of time.
create table public.daily_puzzles (
  day integer not null check (day >= 1),
  category text not null check (category in ('all', 'pop', 'rock', 'luk', 'hiphop')),
  song_id bigint not null references public.songs (id),
  primary key (day, category)
);
create index daily_puzzles_song_id_idx on public.daily_puzzles (song_id);

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day integer not null,
  category text not null,
  -- [{ "result": "wrong" | "artist" | "correct" | "skip", "songId": 123 | null }, ...]
  guesses jsonb not null default '[]'::jsonb,
  tries smallint not null default 0,
  won boolean not null default false,
  -- live: played through the API on its own day (counts for leaderboard and streaks)
  -- archive: a past day played by a Plus member (no stats)
  -- import: copied from the browser after login (stats only, never the leaderboard)
  source text not null default 'live' check (source in ('live', 'archive', 'import')),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, day, category),
  foreign key (day, category) references public.daily_puzzles (day, category)
);
create index game_results_leaderboard_idx
  on public.game_results (day, category, tries, finished_at)
  where won and source = 'live';

create table public.player_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('all', 'pop', 'rock', 'luk', 'hiphop')),
  played integer not null default 0,
  wins integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_day integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- ---------------------------------------------------------------------------
-- Subscriptions (no real payment provider yet: provider = 'mock')
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  price_thb integer not null check (price_thb >= 0),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('active', 'canceled')),
  provider text not null default 'mock' check (provider in ('mock', 'stripe', 'opn')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);

create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  amount_thb integer not null,
  provider text not null check (provider in ('mock', 'stripe', 'opn')),
  status text not null check (status in ('mock_paid', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);
create index payments_user_id_idx on public.payments (user_id);
create index payments_plan_id_idx on public.payments (plan_id);

-- Switches the app can read from SQL. payments_mode = 'mock' enables the fake checkout.
create table private.settings (
  key text primary key,
  value text not null
);
insert into private.settings (key, value) values ('payments_mode', 'mock');

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.artists enable row level security;
alter table public.songs enable row level security;
alter table public.song_previews enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.profiles enable row level security;
alter table public.game_results enable row level security;
alter table public.player_stats enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Public catalogue
create policy "Anyone can read artists" on public.artists
  for select to anon, authenticated using (true);
create policy "Anyone can read active songs" on public.songs
  for select to anon, authenticated using (active);
create policy "Anyone can read active plans" on public.plans
  for select to anon, authenticated using (active);

-- Own rows only
create policy "Players read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Players rename themselves" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Players read their own results" on public.game_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read their own stats" on public.player_stats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read their own subscription" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read their own payments" on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

-- Only the display name can be changed directly; everything else goes through functions.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- The private schema is never exposed through the API.
revoke all on schema private from public, anon, authenticated;
