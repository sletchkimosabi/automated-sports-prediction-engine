import { MatchInput, Side, SeriesLabel } from "@/lib/verdict/types";

const SOFASCORE_BASE_URL = process.env.SOFASCORE_BASE_URL ?? "https://www.sofascore.com/api/v1";

type ContextType = "club" | "selection";

type CompetitionConfig = {
  query: string;
  context: ContextType;
};

const COMPETITIONS: CompetitionConfig[] = [
  { query: "Premier League", context: "club" },
  { query: "Championship", context: "club" },
  { query: "LaLiga", context: "club" },
  { query: "LaLiga 2", context: "club" },
  { query: "Serie A", context: "club" },
  { query: "Serie B", context: "club" },
  { query: "Ligue 1", context: "club" },
  { query: "Ligue 2", context: "club" },
  { query: "Bundesliga", context: "club" },
  { query: "2. Bundesliga", context: "club" },
  { query: "Trendyol Süper Lig", context: "club" },
  { query: "Trendyol 1. Lig", context: "club" },
  { query: "Liga Portugal", context: "club" },
  { query: "Liga Portugal 2", context: "club" },
  { query: "Eredivisie", context: "club" },
  { query: "Eerste Divisie", context: "club" },
  { query: "UEFA Nations League", context: "selection" },
  { query: "Africa Cup of Nations Qualification", context: "selection" },
];

const safeFetchJson = async (path: string): Promise<any> => {
  const url = `${SOFASCORE_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Sofascore fetch failed: ${res.status} ${res.statusText} for ${path}`);
  }

  return res.json();
};

const toDecimal = (fractional: string | null | undefined): number | null => {
  if (!fractional || !fractional.includes("/")) return null;
  const [n, d] = fractional.split("/").map((v) => Number(v));
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return Number((1 + n / d).toFixed(3));
};

const findTournamentId = async (query: string): Promise<number | null> => {
  const data = await safeFetchJson(`/search/all?q=${encodeURIComponent(query)}`);
  const results: any[] = data?.results ?? [];

  for (const row of results) {
    const utId = row?.entity?.uniqueTournament?.id ?? row?.entity?.id;
    if (typeof utId === "number") return utId;
  }
  return null;
};

const findSeasonId = async (tournamentId: number): Promise<number | null> => {
  const data = await safeFetchJson(`/unique-tournament/${tournamentId}/seasons`);
  const seasons: any[] = data?.seasons ?? [];
  const current = seasons.find((s) => s?.year === "2026/27" || s?.name?.toLowerCase?.().includes("2026"));
  const first = current ?? seasons[0];
  return typeof first?.id === "number" ? first.id : null;
};

const isInsideUtcDay = (unixTsSeconds: number, dayIso: string) => {
  const d = new Date(unixTsSeconds * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` === dayIso;
};

const collectCompetitionEvents = async (tournamentId: number, seasonId: number, dayIso: string): Promise<any[]> => {
  const [next, last] = await Promise.all([
    safeFetchJson(`/unique-tournament/${tournamentId}/season/${seasonId}/events/next/0`),
    safeFetchJson(`/unique-tournament/${tournamentId}/season/${seasonId}/events/last/0`),
  ]);

  const merged: any[] = [...(next?.events ?? []), ...(last?.events ?? [])];
  const dedup = new Map<number, any>();

  for (const event of merged) {
    const id = event?.id;
    const ts = event?.startTimestamp;
    const statusType = event?.status?.type;
    if (typeof id !== "number" || typeof ts !== "number") continue;
    if (!isInsideUtcDay(ts, dayIso)) continue;
    if (statusType === "finished" || statusType === "inprogress") continue;
    dedup.set(id, event);
  }

  return [...dedup.values()];
};

const getLastTeamEvents = async (teamId: number): Promise<any[]> => {
  const data = await safeFetchJson(`/team/${teamId}/events/last/0`);
  const events: any[] = data?.events ?? [];
  return events.filter((e) => e?.status?.type === "finished").slice(0, 3);
};

const teamScoredConceded = (event: any, teamId: number) => {
  const isHome = event?.homeTeam?.id === teamId;
  const hs = event?.homeScore?.current;
  const as = event?.awayScore?.current;
  if (typeof hs !== "number" || typeof as !== "number") return null;

  return isHome ? { scored: hs, conceded: as, won: hs > as, lost: hs < as } : { scored: as, conceded: hs, won: as > hs, lost: as < hs };
};

const deriveTeamSignals = (
  events: any[],
  teamId: number,
  side: Side,
): { avgFor: number | null; avgAgainst: number | null; series: SeriesLabel[] } => {
  const samples = events
    .map((e) => teamScoredConceded(e, teamId))
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

const parseOddsPack = async (eventId: number) => {
  const data = await safeFetchJson(`/event/${eventId}/odds/1/all`);
  const markets: any[] = data?.markets ?? [];

  let o1: number | null = null;
  let oX: number | null = null;
  let o2: number | null = null;

  let over15: number | null = null;
  let under35: number | null = null;
  let under45: number | null = null;
  let under55: number | null = null;

  for (const market of markets) {
    const choices: any[] = market?.choices ?? [];

    for (const c of choices) {
      const name = String(c?.name ?? "").toLowerCase();
      const odd = toDecimal(c?.fractionalValue) ?? (typeof c?.decimalValue === "number" ? c.decimalValue : null);
      if (!odd) continue;

      if (name === "1" || name.includes("home")) o1 ??= Number(odd.toFixed(3));
      if (name === "x" || name.includes("draw")) oX ??= Number(odd.toFixed(3));
      if (name === "2" || name.includes("away")) o2 ??= Number(odd.toFixed(3));

      if (name.includes("over") && name.includes("1.5")) over15 ??= Number(odd.toFixed(3));
      if (name.includes("under") && name.includes("3.5")) under35 ??= Number(odd.toFixed(3));
      if (name.includes("under") && name.includes("4.5")) under45 ??= Number(odd.toFixed(3));
      if (name.includes("under") && name.includes("5.5")) under55 ??= Number(odd.toFixed(3));
    }
  }

  return {
    odds: { "1": o1, X: oX, "2": o2 },
    extraOdds: { over15, under35, under45, under55 },
  };
};

export const collectDailyMatchInputs = async (dayIso: string): Promise<MatchInput[]> => {
  const out: MatchInput[] = [];

  for (const competition of COMPETITIONS) {
    try {
      const tournamentId = await findTournamentId(competition.query);
      if (!tournamentId) continue;

      const seasonId = await findSeasonId(tournamentId);
      if (!seasonId) continue;

      const events = await collectCompetitionEvents(tournamentId, seasonId, dayIso);

      for (const event of events) {
        const home = event?.homeTeam?.name;
        const away = event?.awayTeam?.name;
        const homeId = event?.homeTeam?.id;
        const awayId = event?.awayTeam?.id;
        const eventId = event?.id;

        if (!home || !away || typeof homeId !== "number" || typeof awayId !== "number" || typeof eventId !== "number") {
          continue;
        }

        const [oddsPack, homeLast, awayLast] = await Promise.all([
          parseOddsPack(eventId).catch(() => ({ odds: { "1": null, X: null, "2": null }, extraOdds: {} })),
          getLastTeamEvents(homeId).catch(() => []),
          getLastTeamEvents(awayId).catch(() => []),
        ]);

        const homeSignals = deriveTeamSignals(homeLast, homeId, "home");
        const awaySignals = deriveTeamSignals(awayLast, awayId, "away");

        out.push({
          id: String(eventId),
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
    } catch {
      // Ne bloque jamais le pipeline complet à cause d'un championnat.
      continue;
    }
  }

  return out;
};
