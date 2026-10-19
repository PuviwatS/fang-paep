-- ฟังแป๊บ: game, stats, leaderboard, account and mock subscription functions.
--
-- Public functions (schema public) are what the Next.js API routes call through supabase-js `rpc()`.
-- They run as SECURITY DEFINER so they can read the answer tables, and they check `auth.uid()`
-- themselves. Helpers live in schema `private`, which the API cannot reach.
--
-- Errors are raised with a short machine-readable message (e.g. 'plus_required') that the API
-- routes map to HTTP status codes.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Game #1 is 1 October 2026; the number changes at midnight Thai time.
create or replace function private.current_game_day()
returns integer
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Asia/Bangkok')::date - date '2026-10-01') + 1;
$$;

-- Plus = a subscription whose paid period has not ended (a cancelled one runs to its end date).
create or replace function private.is_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user and s.current_period_end > now()
  );
$$;

create or replace function private.assert_category(p_category text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_category is null or p_category not in ('all', 'pop', 'rock', 'luk', 'hiphop') then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
end;
$$;

-- Returns 'live' for today, 'archive' for a past day (Plus only); raises otherwise.
create or replace function private.check_day(p_day integer, p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today integer := private.current_game_day();
begin
  if p_day is null or p_day < 1 or p_day > v_today then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  if p_day = v_today then
    return 'live';
  end if;
  if p_user is null or not private.is_plus(p_user) then
    raise exception 'plus_required' using errcode = '42501';
  end if;
  return 'archive';
end;
$$;

create or replace function private.puzzle_song(p_day integer, p_category text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_song bigint;
begin
  select song_id into v_song from public.daily_puzzles where day = p_day and category = p_category;
  if v_song is null then
    raise exception 'puzzle_not_found' using errcode = 'P0002';
  end if;
  return v_song;
end;
$$;

create or replace function private.evaluate(p_guess bigint, p_answer bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_guess is null then 'skip'
    when p_guess = p_answer then 'correct'
    when (select artist_id from public.songs where id = p_guess)
       = (select artist_id from public.songs where id = p_answer) then 'artist'
    else 'wrong'
  end;
$$;

-- What the player sees once the round is over.
create or replace function private.answer_json(p_song bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'artist', a.name,
    'year', s.year,
    'artworkUrl', p.artwork_url,
    'trackUrl', p.track_url
  )
  from public.songs s
  join public.artists a on a.id = s.artist_id
  left join public.song_previews p on p.song_id = s.id
  where s.id = p_song;
$$;

create or replace function private.stats_json(p_stats public.player_stats)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'played', coalesce(p_stats.played, 0),
    'wins', coalesce(p_stats.wins, 0),
    'streak', coalesce(p_stats.streak, 0),
    'bestStreak', coalesce(p_stats.best_streak, 0),
    'lastDay', coalesce(p_stats.last_day, 0)
  );
$$;

-- Recount a player's stats for one category from their finished games.
-- A streak is a run of won games on consecutive days; a loss or a missed day ends it.
create or replace function private.refresh_player_stats(p_user uuid, p_category text)
returns public.player_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stats public.player_stats;
begin
  with games as (
    select day, won
    from public.game_results
    where user_id = p_user
      and category = p_category
      and finished_at is not null
      and source in ('live', 'import')
  ),
  runs as (
    select day, day - row_number() over (order by day) as run_id
    from games
    where won
  ),
  streaks as (
    select max(day) as last_day, count(*)::integer as length
    from runs
    group by run_id
  )
  insert into public.player_stats as ps (user_id, category, played, wins, streak, best_streak, last_day, updated_at)
  select
    p_user,
    p_category,
    (select count(*) from games),
    (select count(*) from games where won),
    coalesce((select length from streaks where last_day = (select max(day) from games)), 0),
    coalesce((select max(length) from streaks), 0),
    (select max(day) from games),
    now()
  on conflict (user_id, category) do update set
    played = excluded.played,
    wins = excluded.wins,
    streak = excluded.streak,
    best_streak = excluded.best_streak,
    last_day = excluded.last_day,
    updated_at = excluded.updated_at
  returning * into v_stats;

  return v_stats;
end;
$$;

create or replace function private.account_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object('id', p.id, 'displayName', p.display_name, 'createdAt', p.created_at)
      from public.profiles p where p.id = p_user
    ),
    'subscription', (
      select jsonb_build_object(
        'planId', s.plan_id,
        'planName', pl.name,
        'priceThb', pl.price_thb,
        'billingInterval', pl.billing_interval,
        'status', case when s.current_period_end <= now() then 'expired' else s.status end,
        'provider', s.provider,
        'currentPeriodEnd', s.current_period_end,
        'cancelAtPeriodEnd', s.cancel_at_period_end
      )
      from public.subscriptions s
      join public.plans pl on pl.id = s.plan_id
      where s.user_id = p_user
    ),
    'isPlus', private.is_plus(p_user)
  );
$$;

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- New sign-ups get a profile. The display name comes from the sign-up form, else the email.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'ผู้เล่น'
    ), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Game API
-- ---------------------------------------------------------------------------

-- The puzzle for a day: its audio, and the player's progress if they are logged in.
-- The answer is only included once the player's round is finished.
create or replace function public.get_puzzle(p_category text, p_day integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today integer := private.current_game_day();
  v_day integer := coalesce(p_day, v_today);
  v_song bigint;
  v_row public.game_results;
  v_result jsonb;
begin
  perform private.assert_category(p_category);
  perform private.check_day(v_day, v_user);
  v_song := private.puzzle_song(v_day, p_category);

  v_result := jsonb_build_object(
    'day', v_day,
    'today', v_today,
    'category', p_category,
    'previewUrl', (select preview_url from public.song_previews where song_id = v_song),
    'guesses', '[]'::jsonb,
    'finished', false,
    'won', false,
    'answer', null
  );

  if v_user is not null then
    select * into v_row
    from public.game_results
    where user_id = v_user and day = v_day and category = p_category;

    if found then
      v_result := v_result || jsonb_build_object(
        'guesses', v_row.guesses,
        'finished', v_row.finished_at is not null,
        'won', v_row.won
      );
      if v_row.finished_at is not null then
        v_result := v_result || jsonb_build_object('answer', private.answer_json(v_song));
      end if;
    end if;
  end if;

  return v_result;
end;
$$;

-- Check one attempt. p_song_id null = skip.
-- Logged-in players: progress is stored and counted on the server; p_attempt is ignored.
-- Guests: nothing is stored; p_attempt (attempts already used, 0-5) decides when the round ends.
create or replace function public.submit_guess(
  p_category text,
  p_day integer,
  p_song_id bigint default null,
  p_attempt integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_source text;
  v_song bigint;
  v_result text;
  v_tries integer;
  v_finished boolean;
  v_row public.game_results;
  v_stats public.player_stats;
begin
  perform private.assert_category(p_category);
  v_source := private.check_day(p_day, v_user);
  v_song := private.puzzle_song(p_day, p_category);

  if p_song_id is not null and not exists (
    select 1 from public.songs where id = p_song_id and active
  ) then
    raise exception 'unknown_song' using errcode = '22023';
  end if;

  v_result := private.evaluate(p_song_id, v_song);

  if v_user is null then
    if p_attempt is null or p_attempt < 0 or p_attempt > 5 then
      raise exception 'invalid_attempt' using errcode = '22023';
    end if;
    v_tries := p_attempt + 1;
    v_finished := v_result = 'correct' or v_tries >= 6;
    return jsonb_build_object(
      'result', v_result,
      'tries', v_tries,
      'finished', v_finished,
      'won', v_result = 'correct',
      'answer', case when v_finished then private.answer_json(v_song) end,
      'stats', null
    );
  end if;

  insert into public.game_results (user_id, day, category, source)
  values (v_user, p_day, p_category, v_source)
  on conflict (user_id, day, category) do nothing;

  select * into v_row
  from public.game_results
  where user_id = v_user and day = p_day and category = p_category
  for update;

  if v_row.finished_at is not null then
    raise exception 'already_finished' using errcode = '22023';
  end if;
  if p_song_id is not null
     and v_row.guesses @> jsonb_build_array(jsonb_build_object('songId', p_song_id)) then
    raise exception 'already_guessed' using errcode = '22023';
  end if;

  v_tries := v_row.tries + 1;
  v_finished := v_result = 'correct' or v_tries >= 6;

  update public.game_results
  set guesses = guesses || jsonb_build_array(jsonb_build_object('result', v_result, 'songId', p_song_id)),
      tries = v_tries,
      won = v_result = 'correct',
      finished_at = case when v_finished then now() end
  where id = v_row.id;

  if v_finished and v_row.source <> 'archive' then
    v_stats := private.refresh_player_stats(v_user, p_category);
  end if;

  return jsonb_build_object(
    'result', v_result,
    'tries', v_tries,
    'finished', v_finished,
    'won', v_result = 'correct',
    'answer', case when v_finished then private.answer_json(v_song) end,
    'stats', case when v_stats.user_id is not null then private.stats_json(v_stats) end
  );
end;
$$;

-- Top 50 players who solved a day's puzzle live: fewest tries first, then earliest finish.
create or replace function public.get_leaderboard(p_category text, p_day integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today integer := private.current_game_day();
  v_day integer := coalesce(p_day, v_today);
begin
  perform private.assert_category(p_category);
  if v_day < 1 or v_day > v_today then
    raise exception 'invalid_day' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'day', v_day,
    'category', p_category,
    'entries', coalesce((
      select jsonb_agg(entry order by (entry ->> 'rank')::integer, entry ->> 'finishedAt')
      from (
        select jsonb_build_object(
          'rank', rank() over (order by g.tries, g.finished_at),
          'displayName', p.display_name,
          'tries', g.tries,
          'finishedAt', g.finished_at,
          'isPlus', private.is_plus(g.user_id),
          'isMe', g.user_id = auth.uid()
        ) as entry
        from public.game_results g
        join public.profiles p on p.id = g.user_id
        where g.day = v_day and g.category = p_category and g.won and g.source = 'live'
        order by g.tries, g.finished_at
        limit 50
      ) ranked
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_my_stats(p_category text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_stats public.player_stats;
begin
  perform private.assert_category(p_category);
  select * into v_stats from public.player_stats where user_id = v_user and category = p_category;
  return private.stats_json(v_stats);
end;
$$;

-- Copy finished daily games a guest played in this browser into their new account.
-- Results are re-checked against the real answers; imported games never reach the leaderboard.
create or replace function public.import_local_games(p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_today integer := private.current_game_day();
  v_game jsonb;
  v_guess jsonb;
  v_day integer;
  v_category text;
  v_song bigint;
  v_guess_id bigint;
  v_result text;
  v_guesses jsonb;
  v_tries integer;
  v_won boolean;
  v_imported integer := 0;
  v_categories text[] := '{}';
  v_cat text;
begin
  if jsonb_typeof(p_games) is distinct from 'array' then
    raise exception 'invalid_games' using errcode = '22023';
  end if;

  for v_game in select value from jsonb_array_elements(p_games) limit 400 loop
    continue when jsonb_typeof(v_game) <> 'object';
    continue when coalesce(v_game ->> 'day', '') !~ '^\d{1,6}$';
    v_day := (v_game ->> 'day')::integer;
    v_category := v_game ->> 'category';
    continue when v_day < 1 or v_day > v_today;
    continue when v_category is null or v_category not in ('all', 'pop', 'rock', 'luk', 'hiphop');
    continue when exists (
      select 1 from public.game_results where user_id = v_user and day = v_day and category = v_category
    );
    select song_id into v_song from public.daily_puzzles where day = v_day and category = v_category;
    continue when v_song is null;
    continue when jsonb_typeof(v_game -> 'guesses') is distinct from 'array';

    v_guesses := '[]'::jsonb;
    v_tries := 0;
    v_won := false;
    for v_guess in select value from jsonb_array_elements(v_game -> 'guesses') limit 6 loop
      v_guess_id := case
        when jsonb_typeof(v_guess) = 'object' and coalesce(v_guess ->> 'songId', '') ~ '^\d{1,15}$'
          then (v_guess ->> 'songId')::bigint
      end;
      if v_guess_id is not null and not exists (select 1 from public.songs where id = v_guess_id) then
        v_guess_id := null;
      end if;
      v_result := private.evaluate(v_guess_id, v_song);
      v_guesses := v_guesses || jsonb_build_array(jsonb_build_object('result', v_result, 'songId', v_guess_id));
      v_tries := v_tries + 1;
      if v_result = 'correct' then
        v_won := true;
        exit;
      end if;
    end loop;

    -- Unfinished rounds are left in the browser.
    continue when not v_won and v_tries < 6;

    insert into public.game_results (user_id, day, category, guesses, tries, won, source, finished_at)
    values (v_user, v_day, v_category, v_guesses, v_tries, v_won, 'import', now());
    v_imported := v_imported + 1;
    if not v_category = any (v_categories) then
      v_categories := v_categories || v_category;
    end if;
  end loop;

  foreach v_cat in array v_categories loop
    perform private.refresh_player_stats(v_user, v_cat);
  end loop;

  return jsonb_build_object('imported', v_imported);
end;
$$;

-- ---------------------------------------------------------------------------
-- Account and subscription API
-- ---------------------------------------------------------------------------

create or replace function public.get_my_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.account_json(private.require_user());
end;
$$;

create or replace function public.update_display_name(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_name text := trim(coalesce(p_name, ''));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  update public.profiles set display_name = v_name where id = v_user;
  return private.account_json(v_user);
end;
$$;

-- Fake checkout for testing the subscription flow. Works only while payments_mode = 'mock'.
-- A real provider (Stripe / Opn) will replace this with a webhook that writes the same tables.
create or replace function public.mock_checkout(p_plan_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_plan public.plans;
  v_existing public.subscriptions;
  v_period interval;
  v_start timestamptz;
  v_end timestamptz;
begin
  if coalesce((select value from private.settings where key = 'payments_mode'), '') <> 'mock' then
    raise exception 'payments_unavailable' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and active;
  if not found then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;

  v_period := case v_plan.billing_interval when 'year' then interval '1 year' else interval '1 month' end;
  select * into v_existing from public.subscriptions where user_id = v_user for update;

  -- Paying again while still subscribed adds the new period on top of the current one.
  if found and v_existing.current_period_end > now() then
    v_start := v_existing.current_period_start;
    v_end := v_existing.current_period_end + v_period;
  else
    v_start := now();
    v_end := now() + v_period;
  end if;

  insert into public.subscriptions (
    user_id, plan_id, status, provider, current_period_start, current_period_end, cancel_at_period_end
  )
  values (v_user, v_plan.id, 'active', 'mock', v_start, v_end, false)
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    provider = 'mock',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.payments (user_id, plan_id, amount_thb, provider, status)
  values (v_user, v_plan.id, v_plan.price_thb, 'mock', 'mock_paid');

  return private.account_json(v_user);
end;
$$;

-- Stop renewal. Plus stays on until the paid period ends.
create or replace function public.cancel_subscription()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  update public.subscriptions
  set cancel_at_period_end = true, status = 'canceled', updated_at = now()
  where user_id = v_user and current_period_end > now();
  if not found then
    raise exception 'no_active_subscription' using errcode = '22023';
  end if;
  return private.account_json(v_user);
end;
$$;

create or replace function public.resume_subscription()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  update public.subscriptions
  set cancel_at_period_end = false, status = 'active', updated_at = now()
  where user_id = v_user and current_period_end > now();
  if not found then
    raise exception 'no_active_subscription' using errcode = '22023';
  end if;
  return private.account_json(v_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function public.get_puzzle(text, integer) to anon, authenticated;
grant execute on function public.submit_guess(text, integer, bigint, integer) to anon, authenticated;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;

grant execute on function public.get_my_stats(text) to authenticated;
grant execute on function public.import_local_games(jsonb) to authenticated;
grant execute on function public.get_my_account() to authenticated;
grant execute on function public.update_display_name(text) to authenticated;
grant execute on function public.mock_checkout(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
grant execute on function public.resume_subscription() to authenticated;

-- ---------------------------------------------------------------------------
-- Plans (example prices; change them in the plans table)
-- ---------------------------------------------------------------------------

insert into public.plans (id, name, price_thb, billing_interval, features, sort_order) values
  ('plus_monthly', 'พลัส รายเดือน', 49, 'month',
    array['ไม่มีโฆษณา', 'เล่นเพลงประจำวันย้อนหลังได้ทุกวัน', 'ป้ายพลัสบน leaderboard'], 1),
  ('plus_yearly', 'พลัส รายปี', 399, 'year',
    array['ทุกอย่างในรายเดือน', 'ประหยัดกว่าจ่ายรายเดือน 12 ครั้ง'], 2);
