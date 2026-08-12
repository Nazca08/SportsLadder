[5_README.md](https://github.com/user-attachments/files/30989742/5_README.md)
# RallyRank.club

Real, deployed codebase for a tennis/pickleball league app -- Next.js + Supabase, currently live on Vercel.

## What's actually working, live, right now

- Signup/login with real Supabase auth (email confirmation supported)
- Join a league: sport, singles/doubles, division, level, and a fixed 5-area picker (Dallas TX, Utah Valley UT, Palmas Del Mar PR, Minneapolis MN, Raleigh NC)
- Doubles partner search (partner must already have an account)
- Offers (post/accept), challenges (send/accept/decline), each scoped strictly to your league
- Score reporting with two-sided confirmation (reporter can't confirm their own score) or dispute
- Flexible scoring: any number of sets (tennis) or games (pickleball), winner by majority, not locked to best-of-3 or a single game
- Live standings with a real tiebreaker (fewest losses, then most wins, then best win by opponent standing)
- Settings page: profile info, optional team/display name, phone, photo upload (Supabase Storage), email/password change, and a cross-league stats breakdown (overall record, by opponent level, head-to-head)
- Leave a league
- Admin panel (`dynexdynastyadmin@gmail.com`, auto-granted on signup): view/resolve every disputed or unscored match across every league, set final scores directly
- Player avatars and league rank shown next to names in offers and challenges

## Not built yet

- Season-ending tournament brackets and the annual championship -- the seeding/bye/substitution logic is written and unit-tested in `lib/scoring/`, but nothing calls it or writes to `tournaments`/`tournament_matches`/`annual_championships` yet
- Real season scheduling (four 3-month seasons/year, rollover) -- everyone is currently in one continuously-running "Ongoing Season"
- Real payments -- `enrollments.paid` exists but nothing gates on it; no Stripe integration
- Native mobile app -- website only so far

## Project structure

- `supabase/migrations/0001` through `0008` -- run these in order in a fresh Supabase project's SQL Editor. Each is idempotent-safe to re-run.
- `lib/scoring/` -- points formula, tennis/pickleball validation, standings tiebreaker, bracket seeding, annual championship substitution logic. All covered by `lib/scoring/scoring.test.ts` (22 tests, run with `npm test`).
- `lib/leagues/` -- league template matching, entrant name/avatar resolution, standings computation, player stats.
- `lib/supabase/` -- three client variants: `server.ts` (cookie-based SSR client, used in Server Components), `client.ts` (browser client, used for Settings page writes), `admin.ts` (service-role client, bypasses RLS, used for structural writes like league templates), `authed-client.ts` (explicit-Authorization-header client -- see "Known issue" below).
- `app/leagues/join/` -- the league-joining flow.
- `app/leagues/[id]/` -- the league hub: rankings, offers, challenges, matches.
- `app/settings/` -- profile, avatar, account, stats.
- `app/admin/` -- admin-only match resolution panel.

## Setup (fresh Supabase project)

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key + service role key
npm install
npm test                      # 22 tests should pass
npm run dev
```

Run all 8 files in `supabase/migrations/` in order via Supabase's SQL Editor before testing signup.

## An important known issue (already worked around, but worth understanding)

Early on, direct `.insert()` calls through the normal cookie-based SSR client (`lib/supabase/server.ts`) intermittently failed RLS checks on the `enrollments` table, even though extensive diagnostics (matching `auth.uid()`, correct JWT, correct role, and a raw SQL reproduction using the exact same values) all showed the write *should* have succeeded. The root cause was never conclusively identified.

The workaround, used for the join-league and leave-league flows: `.rpc()` calls have been 100% reliable throughout, so those two flows use security-definer Postgres functions (`create_enrollment`, `create_team`, `leave_league`) called via `lib/supabase/authed-client.ts` (a client with the access token attached explicitly), rather than raw table inserts. If you add new user-facing writes and hit the same mysterious RLS failure, this is the pattern to reach for.

Everything else (offers, challenges, score reporting/confirmation, settings updates) uses plain `.insert()`/`.update()` through the normal clients and has worked without issue.
