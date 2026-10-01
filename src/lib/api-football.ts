import { MatchInput, Side, SeriesLabel } from "@/lib/verdict/types";

const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY ?? "";

type ContextType = "club" | "selection";

type CompetitionConfig = {
  query: string;
  context: ContextType;
};

const COMPETITIONS: CompetitionConfig[] = [
  { query: "Premier League", context: "club" },
  { query: "Championship", context: "club" },
  { query: "La Liga", context: "club" },
  { query: "La Liga 2", context: "club" },
  { query: "Serie A", context: "club" },
  { query: "Serie B", context: "club" },
  { query: "Ligue 1", context: "club" },
  { query: "Ligue 2", context: "club" },
  { query: "Bundesliga", context: "club" },
  { query: "2. Bundesliga", context: "club" },
  { query: "Super Lig", context: "club" },
  { query: "1. Lig", context: "club" },
  { query: "Primeira Liga", context: "club" },
  { query: "Liga Portugal 2", context: "club" },
  { query: "Eredivisie", context: "club" },
  { query: "Eerste Divisie", context: "club" },
  { query: "UEFA Nations League", context: "selection" },
  { query: "Africa Cup of Nations - Qualification", context: "selection" },
];

const seasonForDay = (dayIso: string): number => {
  const [y, m] = dayIso.split("-").map(Number);
  // Saison europeenne : annee de demarrage (juillet a juin).
  return m >= 7 ? y : y - 1;
};

const apiFootballFetch = async (path: string): Promise<any> => {
  if (!API_KEY) {
    throw new Error("API_FOOTBALL_KEY manquante (variable d'environnement non definie)");
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-apisports-key": API_KEY,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`API-Football fetch failed: ${res.status} ${res.statusText} for ${path}`);
  }

  const json = await res.json();

  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    throw new Error(`API-Football error for ${path}: ${JSON.stringify(json.errors)}`);
  }
  if (json?.errors && typeof json.errors === "object" && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error for ${path}: ${JSON.stringify(json.errors)}`);
  }

  return json;
};

const findLeagueId = async (query: string, season: number): Promise<number | null> => {
  const data = await apiFootballFetch(`/leagues?search=${encodeURIComponent(query)}`);
  const list: any[] = data?.response ?? [];

  for (const entry of list) {
    const id = entry?.league?.id;
    const seasons: any[] = entry?.seasons ?? [];
    const hasSeason = seasons.some((s) => s?.year === season);
    if (typeof id === "number" && hasSeason) return id;
  }

  // Repli : premiere ligue trouvee, meme si la saison exacte n'est pas confirmee.
  const first = list[0]?.league?.id;
  return typeof first === "number" ? first : null;
};

const getFixturesForDay = async (leagueId: number, season: number, dayIso: string): Promise<any[]> => {
  const data = await apiFootballFetch(`/fixtures?league=${leagueId}&season=${season}&date=${dayIso}`);
  const fixtures: any[] = data?.response ?? [];

  return fixtures.filter((f) => {
    const status = f?.fixture?.status?.short;
    // On exclut les matchs deja termines ou en cours.
    return status === "NS" || status === "TBD" || status === "PST";
  });
};

const getLastTeamFixtures = async (teamId: number): Promise<any[]> => {
  const data = await apiFootballFetch(`/fixtures?team=${teamId}&last=3&status=FT`);
  return data?.response ?? [];
};

const teamScoredConceded = (fixture: any, teamId: number) => {
  const isHome = fixture?.teams?.home?.id === teamId;
  const hs = fixture?.goals?.home;
  const as = fixture?.goals?.away;
  if (typeof hs !== "number" || typeof as !== "number") return null;

  return isHome
    ? { scored: hs, conceded: as, won: hs > as, lost: hs < as }
    : { scored: as, conceded: hs, won: as > hs, lost: as < hs };
};

const deriveTeamSignals = (
  fixtures: any[],
  teamId: number,
  side: Side,
): { avgFor: number | null; avgAgainst: number | null; series: SeriesLabel[] } => {
  const samples = fixtures
    .map((f) => teamScoredConceded(f, teamId))
    .filter((v): v is { scored: number; conceded: number; won: boolean; lost: boolean } => !!v);

  if (!samples.length) return { avgFor: null, avgAgainst: null, series: [] };

  const n = samples.length;
  const sumFor = samples.reduce((acc, s) => acc + s.scored, 0);
  const sumAgainst = samples.reduce((acc, s) => acc + s.conceded, 0);

  const wins = samples.filter((s) => s.won).length;
  const losses = samples.filter((s) => s.lost).length;

  const series: SeriesLabel[] = [];
  if (wins === 3) {
    series.push({ side, label: "3 victoires consécutives", ratio: "3/3" });
    series.push({ side, label: "Invaincu sur les 3 derniers matchs", ratio: "3/3" });
  } else if (losses === 0) {
    series.push({ side, label: "Invaincu sur les 3 derniers matchs", ratio: `${n}/${n}` });
  }

  if (wins === 0) {
    series.push({ side, label: "Aucune victoire sur les 3 derniers matchs", ratio: `0/${n}` });
  }
  if (losses === 3) {
    series.push({ side, label: "3 défaites consécutives", ratio: "3/3" });
  }

  return {
    avgFor: Number((sumFor / n).toFixed(3)),
    avgAgainst: Number((sumAgainst / n).toFixed(3)),
    series,
  };
};

const parseOddsPack = async (fixtureId: number) => {
  const data = await apiFootballFetch(`/odds?fixture=${fixtureId}`);
  const entries: any[] = data?.response ?? [];
  const bookmakers: any[] = entries[0]?.bookmakers ?? [];
  const bookmaker = bookmakers[0];
  const bets: any[] = bookmaker?.bets ?? [];

  let o1: number | null = null;
  let oX: number | null = null;
  let o2: number | null = null;

  let over15: number | null = null;
  let under35: number | null = null;
  let under45: number | null = null;
  let under55: number | null = null;

  const matchWinner = bets.find((b) => b?.name === "Match Winner");
  for (const v of matchWinner?.values ?? []) {
    const odd = Number(v?.odd);
    if (!Number.isFinite(odd)) continue;
    if (v?.value === "Home") o1 ??= odd;
    if (v?.value === "Draw") oX ??= odd;
    if (v?.value === "Away") o2 ??= odd;
  }

  const goalsOverUnder = bets.find((b) => b?.name === "Goals Over/Under");
  for (const v of goalsOverUnder?.values ?? []) {
    const label = String(v?.value ?? "").toLowerCase();
    const odd = Number(v?.odd);
    if (!Number.isFinite(odd)) continue;
    if (label.includes("over") && label.includes("1.5")) over15 ??= odd;
    if (label.includes("under") && label.includes("3.5")) under35 ??= odd;
    if (label.includes("under") && label.includes("4.5")) under45 ??= odd;
    if (label.includes("under") && label.includes("5.5")) under55 ??= odd;
  }

  return {
    odds: { "1": o1, X: oX, "2": o2 },
    extraOdds: { over15, under35, under45, under55 },
  };
};

export const collectDailyMatchInputs = async (dayIso: string): Promise<MatchInput[]> => {
  const out: MatchInput[] = [];
  const failures: { competition: string; error: string }[] = [];
  const season = seasonForDay(dayIso);

  for (const competition of COMPETITIONS) {
    try {
      const leagueId = await findLeagueId(competition.query, season);
      if (!leagueId) continue;

      const fixtures = await getFixturesForDay(leagueId, season, dayIso);

      for (const fixture of fixtures) {
        const home = fixture?.teams?.home?.name;
        const away = fixture?.teams?.away?.name;
        const homeId = fixture?.teams?.home?.id;
        const awayId = fixture?.teams?.away?.id;
        const fixtureId = fixture?.fixture?.id;

        if (!home || !away || typeof homeId !== "number" || typeof awayId !== "number" || typeof fixtureId !== "number") {
          continue;
        }

        const [oddsPack, homeLast, awayLast] = await Promise.all([
          parseOddsPack(fixtureId).catch(() => ({ odds: { "1": null, X: null, "2": null }, extraOdds: {} })),
          getLastTeamFixtures(homeId).catch(() => []),
          getLastTeamFixtures(awayId).catch(() => []),
        ]);

        const homeSignals = deriveTeamSignals(homeLast, homeId, "home");
        const awaySignals = deriveTeamSignals(awayLast, awayId, "away");

        out.push({
          id: String(fixtureId),
          label: `${home} vs ${away}`,
          contexte: competition.context,
          extracted: {
            home,
            away,
            odds: oddsPack.odds,
            series: [...homeSignals.series, ...awaySignals.series],
            h2h: [],
            avgGoalsFor: { home: homeSignals.avgFor, away: awaySignals.avgFor },
            avgGoalsAgainst: { home: homeSignals.avgAgainst, away: awaySignals.avgAgainst },
          },
          extraOdds: oddsPack.extraOdds,
        });
      }
    } catch (error) {
      failures.push({
        competition: competition.query,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  if (out.length === 0 && failures.length > 0) {
    const sample = failures.slice(0, 3)
      .map((f) => `${f.competition} → ${f.error}`)
      .join(" | ");
    throw new Error(
      `Collecte API-Football en échec sur ${failures.length}/${COMPETITIONS.length} championnats. ` +
      `Exemples : ${sample}`,
    );
  }

  return out;
};
