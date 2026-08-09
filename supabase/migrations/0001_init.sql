-- StringLine schema
-- Run this in Supabase: Project -> SQL Editor -> paste and run, or via `supabase db push`.
--
-- One simplification vs. the original design doc: Supabase already gives us `auth.users`
-- (real accounts with real auth), so `profiles` plays the role the build plan called
-- `players` -- no separate players table, this IS it.

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (one row per signed-up user, linked to Supabase auth)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  gender text not null check (gender in ('male','female')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- LEAGUE STRUCTURE
-- ============================================================
create table public.league_templates (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('tennis','pickleball')),
  format text not null check (format in ('singles','doubles')),
  division text not null check (division in ('mens','womens','mixed')),
  level text not null check (level in ('3.0','3.5','4.0','4.5')),
  created_at timestamptz not null default now(),
  unique (sport, format, division, level),
  -- mixed division only makes sense for doubles
  check (division != 'mixed' or format = 'doubles')
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming','active','tournament','completed'))
);

create table public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_template_id uuid not null references public.league_templates(id),
  season_id uuid not null references public.seasons(id),
  unique (league_template_id, season_id)
);

-- ============================================================
-- ENROLLMENT
-- ============================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.league_seasons(id),
  name text not null,
  player1_id uuid not null references public.profiles(id),
  player2_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (player1_id != player2_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.league_seasons(id),
  player_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  -- exactly one of player_id / team_id is set, depending on the league's format
  check ((player_id is not null) <> (team_id is not null))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  stripe_session_id text,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ANNUAL CHAMPIONSHIP (defined early -- matches references it)
-- ============================================================
create table public.annual_championships (
  id uuid primary key default gen_random_uuid(),
  league_template_id uuid not null references public.league_templates(id),
  year integer not null,
  status text not null default 'seeded' check (status in ('seeded','in_progress','completed')),
  unique (league_template_id, year)
);

-- ============================================================
-- MATCHES
-- entrant_a_id / entrant_b_id hold a player_id OR a team_id, depending on
-- the league's format -- resolved in application code, not by a foreign key,
-- same tradeoff described in the build plan (singles/doubles share one schema).
-- ============================================================
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid references public.league_seasons(id),
  annual_championship_id uuid references public.annual_championships(id),
  context text not null check (context in ('league','tournament','annual')),
  match_type text check (match_type in ('offer','challenge')),
  entrant_a_id uuid not null,
  entrant_b_id uuid,
  status text not null default 'open' check (status in ('open','pending','scheduled','completed','cancelled','declined','disputed')),
  scheduled_date date,
  scheduled_time time,
  location text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((league_season_id is not null) or (annual_championship_id is not null))
);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id),
  sets jsonb not null,                 -- tennis: [{"a":6,"b":4}, ...]  pickleball: [{"a":11,"b":7}]
  winner_entrant_id uuid not null,
  points_a integer,
  points_b integer,
  reported_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),   -- null until the opponent confirms (see build plan §6)
  created_at timestamptz not null default now()
);

-- ============================================================
-- SEASON-ENDING TOURNAMENT
-- ============================================================
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null unique references public.league_seasons(id),
  bracket_size integer not null,
  status text not null default 'seeded' check (status in ('seeded','in_progress','completed')),
  winner_entrant_id uuid,
  runner_up_entrant_id uuid
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id),
  round integer not null,
  slot integer not null,
  entrant_a_id uuid,
  entrant_b_id uuid,
  match_id uuid references public.matches(id),
  next_match_id uuid references public.tournament_matches(id)
);

-- ============================================================
-- ANNUAL CHAMPIONSHIP BRACKET
-- ============================================================
create table public.championship_entrants (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.annual_championships(id),
  entrant_id uuid not null,
  league_season_id uuid not null references public.league_seasons(id),
  qualified_as text not null check (qualified_as in ('champion','runner_up')),
  seed integer not null,
  standing_rank integer,          -- their real finish; >2 means they're a substitute (see build plan §9)
  substituted_for uuid            -- entrant_id of who they replaced, if applicable
);

create table public.championship_matches (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.annual_championships(id),
  round integer not null,
  slot integer not null,
  entrant_a_id uuid,
  entrant_b_id uuid,
  match_id uuid references public.matches(id),
  next_match_id uuid references public.championship_matches(id)
);

-- ============================================================
-- HELPER: is the current user enrolled in this league season?
-- (as themselves, or as half of a doubles team). Used everywhere below
-- to enforce "you only see your own league" at the database level.
-- ============================================================
create or replace function public.is_enrolled(p_league_season_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.enrollments e
    where e.league_season_id = p_league_season_id
    and (
      e.player_id = auth.uid()
      or e.team_id in (
        select id from public.teams t
        where t.player1_id = auth.uid() or t.player2_id = auth.uid()
      )
    )
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.league_templates enable row level security;
alter table public.seasons enable row level security;
alter table public.league_seasons enable row level security;
alter table public.teams enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.annual_championships enable row level security;
alter table public.championship_entrants enable row level security;
alter table public.championship_matches enable row level security;

-- Profiles: anyone signed in can see names (needed to show opponents' names
-- on offers/challenges), but you can only edit your own.
create policy "profiles readable by signed-in users" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "users insert their own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "users update their own profile" on public.profiles
  for update using (id = auth.uid());

-- League structure is just configuration -- fine to be world-readable.
create policy "league templates are public" on public.league_templates for select using (true);
create policy "seasons are public" on public.seasons for select using (true);
create policy "league seasons are public" on public.league_seasons for select using (true);

-- Teams and enrollments: only visible to people in that same league season.
create policy "teams viewable by league members" on public.teams
  for select using (is_enrolled(league_season_id));
create policy "players create their own team" on public.teams
  for insert with check (player1_id = auth.uid() or player2_id = auth.uid());

create policy "enrollments viewable by league members" on public.enrollments
  for select using (is_enrolled(league_season_id));
create policy "users enroll themselves" on public.enrollments
  for insert with check (
    player_id = auth.uid()
    or team_id in (select id from public.teams where player1_id = auth.uid() or player2_id = auth.uid())
  );

-- Payments: only visible to the person (or team) who made them.
create policy "users see their own payments" on public.payments
  for select using (
    enrollment_id in (
      select id from public.enrollments
      where player_id = auth.uid()
      or team_id in (select id from public.teams where player1_id = auth.uid() or player2_id = auth.uid())
    )
  );

-- Matches and results: the core rule -- scoped to the league you're enrolled in.
create policy "matches viewable by league members" on public.matches
  for select using (league_season_id is not null and is_enrolled(league_season_id));
create policy "league members create matches" on public.matches
  for insert with check (league_season_id is not null and is_enrolled(league_season_id) and created_by = auth.uid());
create policy "league members update matches in their league" on public.matches
  for update using (league_season_id is not null and is_enrolled(league_season_id));

create policy "match results viewable by league members" on public.match_results
  for select using (
    match_id in (select id from public.matches m where m.league_season_id is not null and is_enrolled(m.league_season_id))
  );
create policy "participants report results" on public.match_results
  for insert with check (reported_by = auth.uid());
create policy "participants confirm results" on public.match_results
  for update using (
    match_id in (select id from public.matches m where m.league_season_id is not null and is_enrolled(m.league_season_id))
  );

-- Tournaments: same league-scoping as league play.
create policy "tournaments viewable by league members" on public.tournaments
  for select using (is_enrolled(league_season_id));
create policy "tournament matches viewable by league members" on public.tournament_matches
  for select using (tournament_id in (select id from public.tournaments t where is_enrolled(t.league_season_id)));

-- Annual championship: this is the "trophy case" -- deliberately public, not
-- scoped to a single league season, since it spans a whole year.
create policy "annual championships are public" on public.annual_championships for select using (true);
create policy "championship entrants are public" on public.championship_entrants for select using (true);
create policy "championship matches are public" on public.championship_matches for select using (true);
