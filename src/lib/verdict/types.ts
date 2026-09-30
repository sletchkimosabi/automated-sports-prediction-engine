export type ContextType = "club" | "selection";

export type Side = "home" | "away";

export type Odds1X2 = {
  "1": number | null;
  X: number | null;
  "2": number | null;
};

export type SeriesLabel = {
  side: Side;
  label: string;
  ratio?: string;
};

export type MatchExtracted = {
  home: string;
  away: string;
  odds: Odds1X2;
  series: SeriesLabel[];
  h2h?: Array<{ side: Side | "both"; label: string; ratio?: string }>;
  avgGoalsFor?: { home: number | null; away: number | null } | null;
  avgGoalsAgainst?: { home: number | null; away: number | null } | null;
};

export type ExtraOdds = {
  over15?: number | null;
  under45?: number | null;
  under35?: number | null;
  under55?: number | null;
  under15_home?: number | null;
  under15_away?: number | null;
};

export type ManualOverride = {
  home?: string;
  away?: string;
  o1?: number | null;
  oX?: number | null;
  o2?: number | null;
};

export type MatchInput = {
  id?: string;
  label?: string;
  contexte: ContextType;
  extracted: MatchExtracted;
  manualOverride?: ManualOverride;
  extraOdds?: ExtraOdds;
};

export type RuleCode =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15"
  | "R16"
  | "R17";

export type Verdict = "RETENU" | "SECONDAIRE" | "SIGNAL_SANS_COTE";

export type MarketKey =
  | "victoire"
  | "dc"
  | "over15"
  | "under35"
  | "under45"
  | "under55"
  | "handicap15"
  | "handicap25"
  | "totalind";

export type MarketResult = {
  key: MarketKey;
  market: string;
  betLabel: string;
  side: Side | null;
  rules: RuleCode[];
  seuil: number;
  odd: number | null;
  oddIsEstimate?: boolean;
  oddNote?: string | null;
  verdict: Verdict;
  margin: number | null;
  maxTaux: number;
  contradictions: string[];
  nbRules: number;
};

export type MatchResult = {
  home: string;
  away: string;
  odds: Odds1X2;
  favSide: Side | null;
  contexte: ContextType;
  markets: MarketResult[];
  score: number;
  hasQualifying: boolean;
};

export type RuleConfig = {
  code: RuleCode;
  market: string;
  n: number;
  s: number;
  active: boolean;
  baseline: boolean;
  unvalidated?: boolean;
};
