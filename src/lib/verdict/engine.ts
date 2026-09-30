import {
  DC_R8_ODD_FLOOR,
  DC_VICTOIRE_ODD_FLOOR,
  OPEN_MATCH_THRESHOLD,
  R14_OX_LOOSE,
  R14_OX_MID,
  R14_OX_STRICT,
  RETENU_TAUX_THRESHOLD,
  RULES,
  TIGHT_MATCH_THRESHOLD_LOOSE,
  TIGHT_MATCH_THRESHOLD_MID,
  TIGHT_MATCH_THRESHOLD_STRICT,
  TOTALIND_THRESHOLD,
  WEAK_ATTACK_THRESHOLD,
  WEAK_DEFENSE_THRESHOLD,
  seuilOf,
  tauxOf,
} from "@/lib/verdict/constants";
import {
  ExtraOdds,
  MarketKey,
  MarketResult,
  MatchExtracted,
  MatchInput,
  MatchResult,
  RuleCode,
  Side,
  Verdict,
} from "@/lib/verdict/types";

type Trigger = {
  rule: RuleCode;
  market: MarketKey;
  side: Side | null;
  note?: string;
};

const normalize = (v: string) => v.trim().toLowerCase();

const hasLabel = (ex: MatchExtracted, side: Side, pattern: RegExp) =>
  ex.series.some((s) => s.side === side && pattern.test(normalize(s.label)));

const isWinStreak = (ex: MatchExtracted, side: Side) => hasLabel(ex, side, /3\s+victoires|wins?\s+streak/);

const isNoDefeatStreak = (ex: MatchExtracted, side: Side) =>
  hasLabel(ex, side, /invaincu|unbeaten|sans\s+défaite/);

const isNoWinOrLossStreak = (ex: MatchExtracted, side: Side) =>
  hasLabel(ex, side, /aucune\s+victoire|no\s+win|défaites|loss(es)?\s+streak/);

const weakAttack = (ex: MatchExtracted, side: Side): boolean => {
  const value = ex.avgGoalsFor?.[side];
  return typeof value === "number" ? value < WEAK_ATTACK_THRESHOLD : false;
};

const weakDefense = (ex: MatchExtracted, side: Side): boolean => {
  const value = ex.avgGoalsAgainst?.[side];
  return typeof value === "number" ? value > WEAK_DEFENSE_THRESHOLD : false;
};

const allFourGoalsAverages = (ex: MatchExtracted): { fh: number; fa: number; ah: number; aa: number } | null => {
  const fh = ex.avgGoalsFor?.home;
  const fa = ex.avgGoalsAgainst?.home;
  const ah = ex.avgGoalsFor?.away;
  const aa = ex.avgGoalsAgainst?.away;
  if ([fh, fa, ah, aa].every((v) => typeof v === "number")) {
    return { fh: fh as number, fa: fa as number, ah: ah as number, aa: aa as number };
  }
  return null;
};

const openMatchSignal = (ex: MatchExtracted) => {
  const all = allFourGoalsAverages(ex);
  if (!all) return false;
  return [all.fh, all.fa, all.ah, all.aa].every((v) => v >= OPEN_MATCH_THRESHOLD);
};

const strongOffenseDefense = (ex: MatchExtracted) => {
  const all = allFourGoalsAverages(ex);
  if (!all) return false;
  return [all.fh, all.fa, all.ah, all.aa].every((v) => v >= 1.5);
};

const tightMatchGoals = (ex: MatchExtracted, threshold: number) => {
  const all = allFourGoalsAverages(ex);
  if (!all) return false;
  return [all.fh, all.fa, all.ah, all.aa].every((v) => v <= threshold);
};

const underGoalsTier = (ex: MatchExtracted, oX: number | null) => {
  const strictByAvg = tightMatchGoals(ex, TIGHT_MATCH_THRESHOLD_STRICT);
  const midByAvg = tightMatchGoals(ex, TIGHT_MATCH_THRESHOLD_MID);
  const looseByAvg = tightMatchGoals(ex, TIGHT_MATCH_THRESHOLD_LOOSE);

  const strictByX = typeof oX === "number" && oX < R14_OX_STRICT;
  const midByX = typeof oX === "number" && oX < R14_OX_MID;
  const looseByX = typeof oX === "number" && oX < R14_OX_LOOSE;

  if (strictByAvg || strictByX) {
    return { key: "under35" as const, r13: strictByAvg, r14: strictByX };
  }
  if (midByAvg || midByX) {
    return { key: "under45" as const, r13: midByAvg, r14: midByX };
  }
  if (looseByAvg || looseByX) {
    return { key: "under55" as const, r13: looseByAvg, r14: looseByX };
  }
  return null;
};

const estimateDcOdd = (oddsX: number | null, oppositeOdd: number | null): number | null => {
  if (typeof oddsX !== "number" || typeof oppositeOdd !== "number") return null;
  return Number(((oddsX * oppositeOdd) / (oddsX + oppositeOdd)).toFixed(3));
};

const getMarketLabel = (key: MarketKey, side: Side | null, home: string, away: string) => {
  const team = side === "home" ? home : side === "away" ? away : null;
  if (key === "victoire") return team ? `Victoire ${team}` : "Victoire simple";
  if (key === "dc") {
    if (!team || !side) return "Double chance";
    return side === "home" ? `Double chance ${team} (1X)` : `Double chance ${team} (X2)`;
  }
  if (key === "over15") return "Plus de 1.5 buts";
  if (key === "under35") return "Moins de 3.5 buts";
  if (key === "under45") return "Moins de 4.5 buts";
  if (key === "under55") return "Moins de 5.5 buts";
  if (key === "handicap15") return team ? `Handicap +1.5 ${team}` : "Handicap +1.5";
  if (key === "handicap25") return team ? `Handicap +2.5 ${team}` : "Handicap +2.5";
  return team
    ? `Total individuel ${team} - moins de ${TOTALIND_THRESHOLD} but`
    : `Total individuel - moins de ${TOTALIND_THRESHOLD} but`;
};

const marketName = (key: MarketKey): string => {
  if (key === "victoire") return "Victoire simple";
  if (key === "dc") return "Double chance";
  if (key === "over15") return "Over 1.5";
  if (key === "under35") return "Under 3.5";
  if (key === "under45") return "Under 4.5";
  if (key === "under55") return "Under 5.5";
  if (key === "handicap15") return "Handicap +1.5";
  if (key === "handicap25") return "Handicap +2.5";
  return "Total individuel";
};

const maxTaux = (rules: RuleCode[]) => Math.max(...rules.map((r) => tauxOf(r)));

const verdictFromRules = (rules: RuleCode[], odd: number | null): Verdict => {
  if (typeof odd !== "number") return "SIGNAL_SANS_COTE";
  return maxTaux(rules) >= RETENU_TAUX_THRESHOLD ? "RETENU" : "SECONDAIRE";
};

const sideOdd = (side: Side | null, o1: number | null, o2: number | null): number | null => {
  if (!side) return null;
  return side === "home" ? o1 : o2;
};

const buildMarket = ({
  key,
  triggers,
  home,
  away,
  o1,
  o2,
  oX,
  extraOdds,
  contradictions,
  ex,
}: {
  key: MarketKey;
  triggers: Trigger[];
  home: string;
  away: string;
  o1: number | null;
  o2: number | null;
  oX: number | null;
  extraOdds: ExtraOdds;
  contradictions: string[];
  ex: MatchExtracted;
}): MarketResult | null => {
  const active = triggers.filter((t) => RULES[t.rule].active && !RULES[t.rule].baseline);
  if (!active.length) return null;

  const rules = active.map((t) => t.rule);
  const uniqueSides = [...new Set(active.map((t) => t.side).filter((s): s is Side => !!s))];
  const side: Side | null = uniqueSides.length === 1 ? uniqueSides[0] : null;

  let odd: number | null = null;
  let oddIsEstimate = false;
  let oddNote: string | null = null;

  if (key === "victoire") {
    odd = sideOdd(side, o1, o2);
  } else if (key === "dc") {
    if (side === "home") odd = estimateDcOdd(oX, o2);
    if (side === "away") odd = estimateDcOdd(oX, o1);
    if (typeof odd === "number") {
      oddIsEstimate = true;
      oddNote = "Cote estimée (pas de cote native DC)";
    }
  } else if (key === "over15") {
    odd = extraOdds.over15 ?? null;
  } else if (key === "under35") {
    odd = extraOdds.under35 ?? null;
  } else if (key === "under45") {
    odd = extraOdds.under45 ?? null;
  } else if (key === "under55") {
    odd = extraOdds.under55 ?? null;
  }

  const seuil = Math.max(...rules.map((r) => seuilOf(r)));
  let verdict = verdictFromRules(rules, odd);

  if (contradictions.length && verdict === "RETENU") verdict = "SECONDAIRE";

  if (key === "dc" && rules.includes("R8") && typeof odd === "number" && odd < DC_R8_ODD_FLOOR) {
    verdict = "SECONDAIRE";
  }

  const includesR1ScenarioA = active.some((t) => t.rule === "R1" && t.note === "scenarioA");
  if (["victoire", "dc", "handicap15"].includes(key) && side && verdict === "RETENU") {
    const hasWeak = weakAttack(ex, side) || weakDefense(ex, side);
    if (hasWeak && !includesR1ScenarioA) {
      verdict = "SECONDAIRE";
    }
  }

  return {
    key,
    market: marketName(key),
    betLabel: getMarketLabel(key, side, home, away),
    side,
    rules,
    seuil,
    odd,
    oddIsEstimate: oddIsEstimate || undefined,
    oddNote,
    verdict,
    margin: typeof odd === "number" ? Number((odd - seuil).toFixed(3)) : null,
    maxTaux: maxTaux(rules),
    contradictions,
    nbRules: rules.length,
  };
};

const scoreMarket = (market: MarketResult) => {
  if (market.verdict === "RETENU") {
    return 5 + market.nbRules * 1.2 + market.maxTaux * 6 - market.contradictions.length * 2;
  }
  if (market.verdict === "SECONDAIRE") {
    return 2 + market.nbRules * 0.8 + market.maxTaux * 4 - market.contradictions.length * 2;
  }
  return 1 + market.nbRules * 0.5 + market.maxTaux * 2 - market.contradictions.length * 2;
};

export const computeMatch = (input: MatchInput): MatchResult => {
  const home = input.manualOverride?.home?.trim() || input.extracted.home;
  const away = input.manualOverride?.away?.trim() || input.extracted.away;

  const o1 = input.manualOverride?.o1 ?? input.extracted.odds["1"];
  const oX = input.manualOverride?.oX ?? input.extracted.odds.X;
  const o2 = input.manualOverride?.o2 ?? input.extracted.odds["2"];

  const ex = input.extracted;
  const extraOdds = input.extraOdds ?? {};

  const favSide: Side | null =
    typeof o1 === "number" && typeof o2 === "number" ? (o1 <= o2 ? "home" : "away") : null;
  const dogSide: Side | null = favSide ? (favSide === "home" ? "away" : "home") : null;
  const favOdd = sideOdd(favSide, o1, o2);

  const triggersByMarket = new Map<MarketKey, Trigger[]>();
  const push = (t: Trigger) => {
    const current = triggersByMarket.get(t.market) ?? [];
    current.push(t);
    triggersByMarket.set(t.market, current);
  };

  if (favSide && dogSide && typeof favOdd === "number") {
    if (favOdd < 1.4 && weakDefense(ex, dogSide)) {
      push({ rule: "R1", market: "victoire", side: favSide, note: "scenarioA" });
    } else if (isWinStreak(ex, favSide) && !weakAttack(ex, favSide) && !weakDefense(ex, favSide)) {
      push({ rule: "R1", market: "victoire", side: favSide, note: "scenarioB" });
    }
  }

  (["home", "away"] as Side[]).forEach((side) => {
    const opp: Side = side === "home" ? "away" : "home";
    if (isWinStreak(ex, side) && isNoWinOrLossStreak(ex, opp)) {
      push({ rule: "R2", market: "victoire", side });
    }
  });

  if (favSide && typeof favOdd === "number" && favOdd < 1.4 && !weakAttack(ex, favSide) && !weakDefense(ex, favSide)) {
    push({ rule: "R4", market: "victoire", side: favSide });
    push({ rule: "R7", market: "dc", side: favSide });
  }

  if (favSide && typeof oX === "number" && oX >= 5 && !weakAttack(ex, favSide) && !weakDefense(ex, favSide)) {
    push({ rule: "R5", market: "victoire", side: favSide });
  }

  (["home", "away"] as Side[]).forEach((side) => {
    if (isNoDefeatStreak(ex, side) && !weakAttack(ex, side) && !weakDefense(ex, side)) {
      push({ rule: "R8", market: "dc", side });
    }
  });

  if (openMatchSignal(ex)) push({ rule: "R9", market: "over15", side: null });
  if (strongOffenseDefense(ex)) push({ rule: "R10", market: "over15", side: null });
  push({ rule: "R11", market: "over15", side: null });

  const tier = underGoalsTier(ex, oX);
  if (tier?.r13) push({ rule: "R13", market: tier.key, side: null });
  if (tier?.r14) push({ rule: "R14", market: tier.key, side: null });
  push({ rule: "R15", market: "under45", side: null });

  const contradictionForSide = (side: Side | null): string[] => {
    if (!side) return [];
    return isNoWinOrLossStreak(ex, side)
      ? [
          `Contradiction: ${side === "home" ? home : away} en série sans victoire/défaites malgré signal`,
        ]
      : [];
  };

  const markets: MarketResult[] = [];
  (["victoire", "dc", "over15", "under35", "under45", "under55"] as MarketKey[]).forEach((key) => {
    const mk = buildMarket({
      key,
      triggers: triggersByMarket.get(key) ?? [],
      home,
      away,
      o1,
      o2,
      oX,
      extraOdds,
      contradictions: contradictionForSide(
        key === "victoire" || key === "dc" ? (triggersByMarket.get(key)?.[0]?.side ?? null) : null,
      ),
      ex,
    });
    if (mk) markets.push(mk);
  });

  const victoire = markets.find((m) => m.key === "victoire");
  const dc = markets.find((m) => m.key === "dc");

  if (victoire && dc) {
    const victoireOdd = victoire.odd;
    if (typeof victoireOdd === "number" && victoireOdd < DC_VICTOIRE_ODD_FLOOR) {
      const idx = markets.findIndex((m) => m.key === "dc");
      if (idx >= 0) markets.splice(idx, 1);
    } else {
      const idx = markets.findIndex((m) => m.key === "victoire");
      if (idx >= 0) markets.splice(idx, 1);
    }
  }

  const currentDc = markets.find((m) => m.key === "dc");
  if (currentDc && currentDc.side && favSide) {
    const outsider: Side = favSide === "home" ? "away" : "home";
    if (currentDc.side === outsider) {
      const designatedOdd = sideOdd(currentDc.side, o1, o2);
      const riskyDc =
        (typeof designatedOdd === "number" && designatedOdd >= 2) ||
        weakAttack(ex, currentDc.side) ||
        currentDc.side === "away";

      if (riskyDc) {
        const replacement: MarketResult = {
          ...currentDc,
          key: "handicap15",
          market: marketName("handicap15"),
          betLabel: getMarketLabel("handicap15", currentDc.side, home, away),
        };
        const idx = markets.findIndex((m) => m.key === "dc");
        markets.splice(idx, 1, replacement);
      } else {
        const rules = [...currentDc.rules];
        if (currentDc.verdict === "SECONDAIRE" && !rules.includes("R17")) rules.push("R17");
        const handicap15: MarketResult = {
          key: "handicap15",
          market: marketName("handicap15"),
          betLabel: getMarketLabel("handicap15", currentDc.side, home, away),
          side: currentDc.side,
          rules,
          seuil: Math.max(...rules.map((r) => seuilOf(r))),
          odd: null,
          oddIsEstimate: undefined,
          oddNote: "Cote handicap native indisponible",
          verdict: "SIGNAL_SANS_COTE",
          margin: null,
          maxTaux: Math.max(...rules.map((r) => tauxOf(r))),
          contradictions: contradictionForSide(currentDc.side),
          nbRules: rules.length,
        };
        markets.push(handicap15);
      }
    }
  }

  const hasH15 = markets.find((m) => m.key === "handicap15");
  if (hasH15 && typeof favOdd === "number" && favOdd < 1.4) {
    markets.push({
      key: "handicap25",
      market: marketName("handicap25"),
      betLabel: getMarketLabel("handicap25", hasH15.side, home, away),
      side: hasH15.side,
      rules: ["R16"],
      seuil: seuilOf("R16"),
      odd: null,
      oddIsEstimate: undefined,
      oddNote: "Cote handicap native indisponible",
      verdict: "SIGNAL_SANS_COTE",
      margin: null,
      maxTaux: tauxOf("R16"),
      contradictions: contradictionForSide(hasH15.side),
      nbRules: 1,
    });
  }

  const weakHome = weakAttack(ex, "home");
  const weakAway = weakAttack(ex, "away");
  if (weakHome || weakAway) {
    let side: Side = "home";
    if (!weakHome) side = "away";
    if (weakHome && weakAway) {
      const homeFor = ex.avgGoalsFor?.home ?? Number.POSITIVE_INFINITY;
      const awayFor = ex.avgGoalsFor?.away ?? Number.POSITIVE_INFINITY;
      side = homeFor <= awayFor ? "home" : "away";
    }
    const odd = side === "home" ? (extraOdds.under15_home ?? null) : (extraOdds.under15_away ?? null);
    markets.push({
      key: "totalind",
      market: marketName("totalind"),
      betLabel: getMarketLabel("totalind", side, home, away),
      side,
      rules: [],
      seuil: 0,
      odd,
      oddIsEstimate: undefined,
      oddNote: null,
      verdict: typeof odd === "number" ? "SECONDAIRE" : "SIGNAL_SANS_COTE",
      margin: null,
      maxTaux: 0,
      contradictions: [],
      nbRules: 0,
    });
  }

  const score = Number(markets.reduce((acc, m) => acc + scoreMarket(m), 0).toFixed(3));

  return {
    home,
    away,
    odds: { "1": o1, X: oX, "2": o2 },
    favSide,
    contexte: input.contexte,
    markets,
    score,
    hasQualifying: markets.length > 0,
  };
};
