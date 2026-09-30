import { insertRunLog, listDaySnapshots, upsertSnapshot } from "@/db/verdict-repo";
import { collectDailyMatchInputs } from "@/lib/sofascore";
import { computeMatch } from "@/lib/verdict/engine";
import { MatchResult } from "@/lib/verdict/types";

const utcDay = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const runDailyPipeline = async (day = utcDay()) => {
  try {
    const inputs = await collectDailyMatchInputs(day);
    const computed = inputs.map((input) => computeMatch(input));

    const club = computed
      .filter((m) => m.contexte === "club")
      .sort((a, b) => b.score - a.score);
    const selection = computed
      .filter((m) => m.contexte === "selection")
      .sort((a, b) => b.score - a.score);

    await upsertSnapshot({
      day,
      context: "club",
      qualifiedCount: club.filter((m) => m.hasQualifying).length,
      matchesJson: club,
    });

    await upsertSnapshot({
      day,
      context: "selection",
      qualifiedCount: selection.filter((m) => m.hasQualifying).length,
      matchesJson: selection,
    });

    await insertRunLog({
      day,
      status: "ok",
      message: `Pipeline OK (${computed.length} matchs calculés)`,
    });

    return { day, club, selection, computedCount: computed.length, refreshed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await insertRunLog({ day, status: "error", message });
    throw error;
  }
};

const asResults = (json: unknown): MatchResult[] => {
  if (!Array.isArray(json)) return [];
  return json as MatchResult[];
};

export const getOrRefreshDailyVerdicts = async (opts?: { force?: boolean; day?: string }) => {
  const day = opts?.day ?? utcDay();
  const snapshots = await listDaySnapshots(day);

  if (!snapshots.length || opts?.force) {
    return runDailyPipeline(day);
  }

  const club = snapshots.find((s) => s.context === "club");
  const selection = snapshots.find((s) => s.context === "selection");

  return {
    day,
    club: asResults(club?.matchesJson),
    selection: asResults(selection?.matchesJson),
    computedCount: asResults(club?.matchesJson).length + asResults(selection?.matchesJson).length,
    refreshed: false,
  };
};
