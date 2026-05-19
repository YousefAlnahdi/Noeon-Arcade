-- ============================================================
-- NEON ARCADE — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- Extends Supabase Auth with display name, avatar, rank, etc.
-- Auto-created when a user signs up via trigger.
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  rank text default 'Rookie',
  total_tokens integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast username lookups
create index idx_profiles_username on public.profiles(username);

-- Enable RLS
alter table public.profiles enable row level security;

-- Anyone can read profiles (for leaderboards, etc.)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ============================================================
-- 2. GAME SESSIONS TABLE
-- Stores every completed game with result, score, telemetry.
-- ============================================================
create table public.game_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_type text not null check (game_type in ('tictactoe', 'snake')),
  game_mode text not null,
    -- tictactoe modes: 'pvp', 'persona', 'coach'
    -- snake modes:     'classic', 'gamemaster', 'rival'
  result text not null check (result in ('win', 'loss', 'draw')),
  score integer default 0,
  opponent_score integer default 0,
  duration_ms integer default 0,
  ai_persona text,
    -- For tictactoe persona mode: 'provoker', 'cheerleader', 'joker'
  telemetry jsonb default '{}'::jsonb,
    -- Flexible JSON for game-specific stats:
    -- TicTacToe: { offensive_moves, defensive_moves, avg_think_time_ms }
    -- Snake:     { death_cause, shields_used, agility, max_combo }
  ai_analysis text,
    -- LLM-generated post-game analysis text
  tokens_earned integer default 0,
  created_at timestamptz default now()
);

-- Index for fast lookups by user
create index idx_game_sessions_user on public.game_sessions(user_id);
-- Index for filtering by game type
create index idx_game_sessions_type on public.game_sessions(user_id, game_type);
-- Index for recent games (sorted)
create index idx_game_sessions_recent on public.game_sessions(user_id, created_at desc);

-- Enable RLS
alter table public.game_sessions enable row level security;

-- Users can view their own game sessions
create policy "Users can view own game sessions"
  on public.game_sessions for select
  using (auth.uid() = user_id);

-- Users can insert their own game sessions
create policy "Users can insert own game sessions"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);


-- ============================================================
-- 3. PLAYER STATS VIEW
-- Aggregated stats computed from game_sessions.
-- Use this for the dashboard and profile page.
-- ============================================================
create or replace view public.player_stats as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.rank,
  p.total_tokens,

  -- Overall stats
  count(gs.id) as total_games,
  count(gs.id) filter (where gs.result = 'win') as total_wins,
  count(gs.id) filter (where gs.result = 'loss') as total_losses,
  count(gs.id) filter (where gs.result = 'draw') as total_draws,
  case
    when count(gs.id) > 0
    then round((count(gs.id) filter (where gs.result = 'win')::numeric / count(gs.id)) * 100, 1)
    else 0
  end as win_rate,

  -- TicTacToe stats
  count(gs.id) filter (where gs.game_type = 'tictactoe') as xo_games,
  count(gs.id) filter (where gs.game_type = 'tictactoe' and gs.result = 'win') as xo_wins,
  count(gs.id) filter (where gs.game_type = 'tictactoe' and gs.result = 'loss') as xo_losses,
  count(gs.id) filter (where gs.game_type = 'tictactoe' and gs.result = 'draw') as xo_draws,

  -- Snake stats
  count(gs.id) filter (where gs.game_type = 'snake') as snake_games,
  count(gs.id) filter (where gs.game_type = 'snake' and gs.result = 'win') as snake_wins,
  count(gs.id) filter (where gs.game_type = 'snake' and gs.result = 'loss') as snake_losses,
  coalesce(max(gs.score) filter (where gs.game_type = 'snake'), 0) as snake_high_score,

  -- Streaks
  coalesce(max(gs.score), 0) as highest_score,
  coalesce(sum(gs.tokens_earned), 0) as lifetime_tokens_earned

from public.profiles p
left join public.game_sessions gs on gs.user_id = p.id
group by p.id, p.username, p.display_name, p.rank, p.total_tokens;


-- ============================================================
-- 4. AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- When a user signs up via Supabase Auth, automatically
-- create a profile row with their email as the username.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fires after every new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 5. UPDATE TOKENS ON GAME COMPLETION (Trigger)
-- When a game session is inserted, add tokens_earned
-- to the player's profile.
-- ============================================================
create or replace function public.update_player_tokens()
returns trigger as $$
begin
  update public.profiles
  set
    total_tokens = total_tokens + new.tokens_earned,
    updated_at = now()
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_game_session_created
  after insert on public.game_sessions
  for each row execute function public.update_player_tokens();


-- ============================================================
-- 6. UPDATE RANK BASED ON WINS (Trigger)
-- Automatically promotes player rank based on total wins.
-- ============================================================
create or replace function public.update_player_rank()
returns trigger as $$
declare
  win_count integer;
  new_rank text;
begin
  select count(*) into win_count
  from public.game_sessions
  where user_id = new.user_id and result = 'win';

  new_rank := case
    when win_count >= 100 then 'Neon Legend'
    when win_count >= 50  then 'Arcade Master'
    when win_count >= 25  then 'Cyber Knight III'
    when win_count >= 15  then 'Cyber Knight II'
    when win_count >= 10  then 'Cyber Knight I'
    when win_count >= 5   then 'Circuit Runner'
    when win_count >= 1   then 'Pixel Cadet'
    else 'Rookie'
  end;

  update public.profiles
  set rank = new_rank, updated_at = now()
  where id = new.user_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_game_session_rank_update
  after insert on public.game_sessions
  for each row execute function public.update_player_rank();


-- ============================================================
-- DONE! Your schema is ready.
-- 
-- Tables created:
--   • profiles        — user profiles (auto-created on signup)
--   • game_sessions   — every game result + telemetry
--
-- Views created:
--   • player_stats    — aggregated stats per player
--
-- Triggers created:
--   • on_auth_user_created      — auto-create profile on signup
--   • on_game_session_created   — add tokens on game complete
--   • on_game_session_rank_update — promote rank based on wins
--
-- Rank progression:
--   Rookie → Pixel Cadet → Circuit Runner → 
--   Cyber Knight I → II → III → Arcade Master → Neon Legend
-- ============================================================
