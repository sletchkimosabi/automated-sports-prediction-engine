import { RuleCode, RuleConfig } from "@/lib/verdict/types";

export const DC_R8_ODD_FLOOR = 1.4;
export const DC_VICTOIRE_ODD_FLOOR = 1.4;
export const RETENU_TAUX_THRESHOLD = 0.9;
export const WEAK_ATTACK_THRESHOLD = 1.2;
export const WEAK_DEFENSE_THRESHOLD = 1.5;
export const OPEN_MATCH_THRESHOLD = 1.3;
export const TOTALIND_THRESHOLD = 1.5;

export const TIGHT_MATCH_THRESHOLD_STRICT = 0.8;
export const TIGHT_MATCH_THRESHOLD_MID = 1;
export const TIGHT_MATCH_THRESHOLD_LOOSE = 1.3;

export const R14_OX_STRICT = 3.0;
export const R14_OX_MID = 3.6;
export const R14_OX_LOOSE = 4.2;

export const RULES: Record<RuleCode, RuleConfig> = {
  R1: { code: "R1", market: "Victoire simple", n: 15, s: 13, active: true, baseline: false, unvalidated: true },
  R2: { code: "R2", market: "Victoire simple", n: 7, s: 7, active: true, baseline: false },
  R3: { code: "R3", market: "Victoire simple", n: 15, s: 13, active: false, baseline: false },
  R4: { code: "R4", market: "Victoire simple", n: 14, s: 12, active: true, baseline: false },
  R5: { code: "R5", market: "Victoire simple", n: 17, s: 14, active: true, baseline: false },
  R6: { code: "R6", market: "Double chance", n: 31, s: 29, active: false, baseline: false },
  R7: { code: "R7", market: "Double chance", n: 14, s: 13, active: true, baseline: false },
  R8: { code: "R8", market: "Double chance", n: 29, s: 25, active: true, baseline: false },
  R9: { code: "R9", market: "Plus de 1.5 buts", n: 23, s: 22, active: true, baseline: false, unvalidated: true },
  R10: { code: "R10", market: "Plus de 1.5 buts", n: 45, s: 43, active: true, baseline: false },
  R11: { code: "R11", market: "Plus de 1.5 buts", n: 71, s: 66, active: true, baseline: true },
  R12: { code: "R12", market: "Moins de X buts", n: 14, s: 12, active: false, baseline: false },
  R13: { code: "R13", market: "Moins de X buts", n: 22, s: 17, active: true, baseline: false },
  R14: { code: "R14", market: "Moins de X buts", n: 15, s: 10, active: true, baseline: false },
  R15: { code: "R15", market: "Moins de X buts", n: 71, s: 43, active: true, baseline: true },
  R16: { code: "R16", market: "Handicap +2.5 buts", n: 17, s: 17, active: true, baseline: false },
  R17: { code: "R17", market: "Handicap +1.5 buts", n: 11, s: 11, active: true, baseline: false },
};

export const tauxOf = (rule: RuleCode): number => RULES[rule].s / RULES[rule].n;
export const seuilOf = (rule: RuleCode): number => 1 / tauxOf(rule);
