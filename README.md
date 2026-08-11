# StringLine

Real codebase for the tennis/pickleball league app -- Next.js + Supabase.
This is the **foundational layer**: project setup, the full database schema
with Row Level Security, the scoring/points/tiebreaker/bracket logic as
tested code, and working signup/login. League enrollment, offers,
challenges, and standings pages are the next build phase.

## What's actually in here

- `supabase/migrations/0001_init.sql` -- the full schema: leagues, seasons,
  enrollments, teams, matches, tournaments, annual championships, and the
  Row Level Security policies that enforce "you only see your own league"
  at the database level.
- `lib/scoring/` -- the points formula, tennis/pickleball validation,
  standings tiebreaker, and annual championship substitution logic, each
  with unit tests (`npm test`). This is meant to be the one place that
  logic lives, shared by the website today and a native app later.
- `app/` -- signup, login, and a placeholder dashboard proving auth works
  end-to-end against Supabase.

## 1. Create the Supabase project

1. In your Supabase dashboard, create a new project.
2. Go to the **SQL Editor**, paste in the entire contents of
   `supabase/migrations/0001_init.sql`, and run it. This creates every
   table and turns on Row Level Security.
3. Go to **Project Settings -> API**. You'll need two values from here in
   a minute: the **Project URL** and the **anon public key**.

## 2. Set up your local environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the two values from Supabase step 3 above.
`.env.local` is already in `.gitignore` -- it will never get pushed to
GitHub.

```bash
npm install
npm test        # confirms the scoring logic passes (17 tests)
npm run dev      # runs locally at http://localhost:3000
```

Try signing up at `/signup` -- it should create a real account and land
you on `/dashboard`.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial StringLine scaffold"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/stringline.git
git push -u origin main
```

(Create the empty repo on GitHub first, then use its URL in place of
`YOUR-USERNAME/stringline` above.)

## 4. Deploy on Vercel

1. In Vercel, "Add New Project" and import the GitHub repo you just pushed.
2. Vercel will detect it's a Next.js project automatically.
3. Before deploying, add the same two environment variables from step 1
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) under
   the project's **Settings -> Environment Variables**.
4. Deploy. From here on, every push to `main` on GitHub redeploys
   automatically.

## What's next

The build plan (from our earlier design conversation) is the roadmap:
league enrollment and the sport/format/division/level picker, offers and
challenges scoped to a league, score entry wired to `lib/scoring/`,
standings, the season-ending bracket, and the annual championship. Each of
those is a real, testable slice we can build the same way this layer was
built -- schema first, logic tested, then the UI on top.

