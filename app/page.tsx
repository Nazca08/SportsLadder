import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The racquet string-bed texture used behind the hero and the closing CTA.
const STRING_BED = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(244,242,233,0.06) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, rgba(244,242,233,0.05) 0 1px, transparent 1px 24px)",
};

const STEPS = [
  {
    n: "01",
    title: "Join your league",
    body: "Pick your sport, singles or doubles, your division, your level, and your area. That combination is your league, and everyone in it is someone you could reasonably play.",
  },
  {
    n: "02",
    title: "Find a match",
    body: "Post an offer that anyone in your league can accept, or send a challenge straight to one player. No group chats, no organizing, no chasing people down.",
  },
  {
    n: "03",
    title: "Play and report the score",
    body: "Play as many sets as you both want. One of you enters the score, the other confirms it. If something looks wrong, either side can dispute it and an admin sorts it out.",
  },
  {
    n: "04",
    title: "Climb the standings",
    body: "Every confirmed match moves you. Wins, losses, and the strength of who you beat all count. Your rank updates the moment the score is confirmed.",
  },
];

const SEASONS = [
  { name: "Season 1", months: "January - March" },
  { name: "Season 2", months: "April - June" },
  { name: "Season 3", months: "July - September" },
  { name: "Season 4", months: "October - December" },
];

const AREAS = [
  "Dallas, TX",
  "Utah Valley, UT",
  "Palmas Del Mar, PR",
  "Minneapolis, MN",
  "Raleigh, NC",
];

const LADDER = [
  { rank: "1", name: "Reyes, M.", record: "11-2" },
  { rank: "2", name: "Okafor, D.", record: "10-3" },
  { rank: "3", name: "You", record: "9-3", you: true },
  { rank: "4", name: "Lindqvist, A.", record: "8-5" },
  { rank: "5", name: "Barrera, J.", record: "7-5" },
];

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in players skip the pitch and go straight to their leagues.
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-court text-chalk">
      {/* ---------------------------------------------------------------- nav */}
      <header className="sticky top-0 z-50 border-b border-chalk/10 bg-court/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-bold tracking-[0.18em]">
            STRING<span className="text-ball">LINE</span>
          </span>
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="rounded-lg px-4 py-2 font-display text-sm font-semibold tracking-wide text-chalk-dim transition-colors hover:text-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="rounded-lg bg-ball px-4 py-2 font-display text-sm font-semibold tracking-wide text-ink transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball"
            >
              Sign up
            </a>
          </div>
        </nav>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-chalk/10">
        <div className="absolute inset-0" style={STRING_BED} aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-court/60 to-court"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-0 hidden h-full w-px bg-gradient-to-b from-ball/0 via-ball/50 to-ball/0 lg:block"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="font-score text-xs tracking-[0.22em] text-ball">
              TENNIS + PICKLEBALL / SINGLES + DOUBLES
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Somebody your level is
              <br className="hidden sm:block" /> looking for a game.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-chalk-dim sm:text-lg">
              StringLine puts you in a league with players in your area, playing your
              sport, in your division, at your rating. Post an offer, play the match,
              report the score. The standings take care of themselves.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="/signup"
                className="rounded-xl bg-ball px-7 py-3.5 font-display text-base font-semibold tracking-wide text-ink transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball"
              >
                Join a league
              </a>
              <a
                href="/login"
                className="rounded-xl border border-chalk/20 px-7 py-3.5 font-display text-base font-semibold tracking-wide text-chalk transition-colors hover:border-chalk/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball"
              >
                I already play here
              </a>
            </div>
            <p className="mt-6 font-score text-xs tracking-wider text-chalk-dim">
              LEVELS 3.0 - 4.5 / FIVE MARKETS / FOUR SEASONS A YEAR
            </p>
          </div>

          {/* standings card - shows what the whole thing is actually for */}
          <div className="rounded-2xl border border-chalk/10 bg-panel/80 p-6 shadow-2xl shadow-court-deep/50 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-sm font-semibold tracking-[0.15em] text-chalk">
                STANDINGS
              </p>
              <p className="font-score text-[10px] tracking-wider text-chalk-dim">
                MEN&apos;S SINGLES 4.0 / DALLAS
              </p>
            </div>
            <div className="mt-5 space-y-1">
              {LADDER.map((row) => (
                <div
                  key={row.rank}
                  className={
                    "flex items-center gap-4 rounded-lg px-3 py-2.5 " +
                    (row.you ? "bg-ball/10 ring-1 ring-ball/40" : "")
                  }
                >
                  <span
                    className={
                      "font-score text-sm " + (row.you ? "text-ball" : "text-chalk-dim")
                    }
                  >
                    {row.rank}
                  </span>
                  <span
                    className={
                      "flex-1 text-sm " +
                      (row.you ? "font-semibold text-chalk" : "text-chalk-dim")
                    }
                  >
                    {row.name}
                  </span>
                  <span className="font-score text-sm text-chalk">{row.record}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-chalk/10 pt-4">
              <p className="text-xs leading-relaxed text-chalk-dim">
                Ties break on fewest losses, then most wins, then the quality of who you
                beat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- story */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative">
            <div
              className="absolute -bottom-4 -right-4 h-full w-full rounded-2xl border border-ball/30"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/family.jpg"
              alt="The family that started StringLine, standing together by a lake."
              className="relative w-full rounded-2xl object-cover"
            />
          </div>

          <div>
            <p className="font-score text-xs tracking-[0.22em] text-ball">
              WHY WE BUILT IT
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
              It started with a family that could never find enough people to play.
            </h2>

            {/* ===== EDIT THE THREE PARAGRAPHS BELOW WITH YOUR REAL STORY ===== */}
            <div className="mt-6 space-y-4 text-base leading-relaxed text-chalk-dim">
              <p>
                We are a tennis family. Between the six of us there is always somebody
                looking for a match, and for years the hard part was never the court or
                the time or the wanting to play. It was finding one person at the same
                level who would actually show up.
              </p>
              <p>
                Everyone knows the pattern. You join a club and get put in a clinic. You
                text three people and hear back from none. You play the same friend every
                week until one of you gets bored. Meanwhile there are dozens of players
                fifteen minutes away, at exactly your level, having exactly the same
                problem.
              </p>
              <p>
                So we built the thing we wanted: a real league, with real standings, where
                the only thing you have to do is show up and play. StringLine is what
                happens when a family gets tired of looking for a game.
              </p>
            </div>
            {/* ===== END OF THE EDITABLE STORY ===== */}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px w-full bg-chalk/10" />
      </div>

      {/* ------------------------------------------------------ how it works */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <p className="font-score text-xs tracking-[0.22em] text-ball">HOW IT WORKS</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
          Four steps, then you are in the standings.
        </h2>

        <div className="relative mt-14">
          {/* the ladder the steps hang off */}
          <div
            className="absolute left-[19px] top-2 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-ball via-ball/40 to-ball/0 sm:block"
            aria-hidden="true"
          />
          <ol className="space-y-10">
            {STEPS.map((step) => (
              <li key={step.n} className="relative sm:pl-16">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-ball/40 bg-court font-score text-sm text-ball sm:absolute sm:left-0 sm:top-0 sm:mb-0">
                  {step.n}
                </span>
                <h3 className="font-display text-xl font-semibold tracking-wide sm:pt-1.5">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-chalk-dim">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- seasons */}
      <section className="border-y border-chalk/10 bg-court-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="font-score text-xs tracking-[0.22em] text-paddle">
                THE SEASON
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
                Four seasons a year. Every one ends with a champion.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-chalk-dim">
                The year splits into four three-month seasons. You play as many matches as
                you can fit in, and every confirmed result moves you up or down your
                league&apos;s ladder.
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-chalk-dim">
                When the season closes, the standings set the bracket. The top players in
                every league go into a tournament, and one of them walks out the champion
                of that league for that season. Then the ladder resets and everybody gets
                another run at it.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SEASONS.map((season) => (
                <div
                  key={season.name}
                  className="rounded-xl border border-chalk/10 bg-panel/60 p-5"
                >
                  <p className="font-display text-lg font-semibold tracking-wide">
                    {season.name}
                  </p>
                  <p className="mt-1 font-score text-xs tracking-wider text-chalk-dim">
                    {season.months.toUpperCase()}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-paddle/40 bg-paddle/10 p-5 sm:col-span-2">
                <p className="font-display text-lg font-semibold tracking-wide text-paddle">
                  Season tournament
                </p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-dim">
                  Seeded off the final standings. One champion crowned per league, per
                  season.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ areas */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="font-score text-xs tracking-[0.22em] text-ball">
              WHERE WE PLAY
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
              Five markets, and counting.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-chalk-dim">
              Leagues are scoped to a market so your matches stay a short drive away. If
              your area is not on the list yet, sign up anyway and tell us where you play.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {AREAS.map((area) => (
              <li
                key={area}
                className="flex items-center gap-3 rounded-xl border border-chalk/10 bg-panel/50 px-5 py-4"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-ball"
                  aria-hidden="true"
                />
                <span className="font-display text-base font-medium tracking-wide">
                  {area}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="relative overflow-hidden border-t border-chalk/10">
        <div className="absolute inset-0" style={STRING_BED} aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-b from-court via-court/70 to-court"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
            Get in a league. Play this week.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-chalk-dim sm:text-lg">
            Signing up takes a minute. Pick your sport, your level, and your area, and you
            are on the ladder.
          </p>
          <a
            href="/signup"
            className="mt-9 inline-block rounded-xl bg-ball px-9 py-4 font-display text-lg font-semibold tracking-wide text-ink transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball"
          >
            Join a league
          </a>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="border-t border-chalk/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <span className="font-display text-sm font-bold tracking-[0.18em]">
            STRING<span className="text-ball">LINE</span>
          </span>
          <div className="flex items-center gap-5 font-score text-xs tracking-wider text-chalk-dim">
            <a href="/login" className="transition-colors hover:text-chalk">
              LOG IN
            </a>
            <a href="/signup" className="transition-colors hover:text-chalk">
              SIGN UP
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
