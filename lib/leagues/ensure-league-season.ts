import { createAdminClient } from "@/lib/supabase/admin";

const CURRENT_SEASON_NAME = "Ongoing Season";

/**
 * Finds or creates the league_season for this exact sport/format/division/level
 * + area combo, in whatever season is currently active. `area` is one of the
 * fixed markets RallyRank.club operates in (see lib/leagues/divisions.ts AREAS) --
 * someone in Dallas never sees someone in Raleigh's offers, challenges, or
 * standings, even at the identical sport/format/division/level.
 * Real season scheduling (four 3-month seasons a year, rollover, tournament
 * windows) is a later build phase -- for now every enrollment lands in one
 * continuously-running season so the core league loop (offers, challenges,
 * scoring, standings) can be built and tested against something real.
 */
/**
 * Season lookup for a league_template that already exists -- named club
 * leagues, which are created by migration rather than conjured from dropdown
 * choices. Deliberately never inserts a template: if the id is wrong we want a
 * failure, not a silent empty league.
 */
export async function ensureLeagueSeasonForTemplate(templateId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: template } = await admin
    .from("league_templates")
    .select("id")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) throw new Error("That league no longer exists.");

  const seasonId = await currentSeasonId();

  let { data: leagueSeason } = await admin
    .from("league_seasons")
    .select("id")
    .match({ league_template_id: templateId, season_id: seasonId })
    .maybeSingle();

  if (!leagueSeason) {
    const { data: created, error } = await admin
      .from("league_seasons")
      .insert({ league_template_id: templateId, season_id: seasonId })
      .select("id")
      .single();
    if (error) throw error;
    leagueSeason = created;
  }

  return leagueSeason.id as string;
}

/** The season everything currently lands in. Shared by both entry points. */
async function currentSeasonId(): Promise<string> {
  const admin = createAdminClient();

  let { data: season } = await admin
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!season) {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    const { data: created, error } = await admin
      .from("seasons")
      .insert({
        name: CURRENT_SEASON_NAME,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    season = created;
  }

  return season.id as string;
}

export async function ensureLeagueSeason(
  sport: string,
  format: string,
  division: string,
  level: string,
  area: string
): Promise<string> {
  const admin = createAdminClient();

  let { data: template } = await admin
    .from("league_templates")
    .select("id")
    .match({ sport, format, division, level, area })
    .maybeSingle();

  if (!template) {
    const { data: created, error } = await admin
      .from("league_templates")
      .insert({ sport, format, division, level, area })
      .select("id")
      .single();
    if (error) throw error;
    template = created;
  }

  const seasonId = await currentSeasonId();

  let { data: leagueSeason } = await admin
    .from("league_seasons")
    .select("id")
    .match({ league_template_id: template.id, season_id: seasonId })
    .maybeSingle();

  if (!leagueSeason) {
    const { data: created, error } = await admin
      .from("league_seasons")
      .insert({ league_template_id: template.id, season_id: seasonId })
      .select("id")
      .single();
    if (error) throw error;
    leagueSeason = created;
  }

  return leagueSeason.id as string;
}
