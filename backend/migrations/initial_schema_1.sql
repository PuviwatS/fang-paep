create schema if not exists private;

create table public.users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index auth_sessions_user_id_idx on public.auth_sessions(user_id);

create table public.auth_tokens (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null check (purpose in ('verify', 'reset')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.artists (
  id bigint generated always as identity primary key,
  name text not null unique,
  aliases text[] not null default '{}'
);
create table public.songs (
  id bigint primary key,
  title text not null,
  artist_id bigint not null references public.artists(id),
  category text not null check (category in ('pop', 'rock', 'luk', 'hiphop')),
  year smallint,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index songs_artist_id_idx on public.songs(artist_id);
create table public.song_previews (
  song_id bigint primary key references public.songs(id) on delete cascade,
  preview_url text not null,
  artwork_url text,
  track_url text,
  updated_at timestamptz not null default now()
);
create table public.daily_puzzles (
  day integer not null check (day >= 1),
  category text not null check (category in ('all', 'pop', 'rock', 'luk', 'hiphop')),
  song_id bigint not null references public.songs(id),
  primary key(day, category)
);
create index daily_puzzles_song_id_idx on public.daily_puzzles(song_id);

create table public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day integer not null,
  category text not null check (category in ('all', 'pop', 'rock', 'luk', 'hiphop')),
  guesses jsonb not null default '[]'::jsonb,
  tries smallint not null default 0,
  won boolean not null default false,
  source text not null default 'live' check (source in ('live', 'archive', 'import')),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, day, category),
  foreign key(day, category) references public.daily_puzzles(day, category)
);
create index game_results_leaderboard_idx on public.game_results(day, category, tries, finished_at) where won and source = 'live';
create table public.player_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('all', 'pop', 'rock', 'luk', 'hiphop')),
  played integer not null default 0,
  wins integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_day integer,
  updated_at timestamptz not null default now(),
  primary key(user_id, category)
);
create table public.plans (
  id text primary key,
  name text not null,
  price_thb integer not null check(price_thb >= 0),
  billing_interval text not null check(billing_interval in ('month', 'year')),
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0
);
create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check(status in ('active', 'canceled')),
  provider text not null default 'mock' check(provider in ('mock', 'stripe', 'opn')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount_thb integer not null,
  provider text not null check(provider in ('mock', 'stripe', 'opn')),
  status text not null check(status in ('mock_paid', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);
create table private.settings (key text primary key, value text not null);
insert into private.settings(key, value) values ('payments_mode', 'mock');
