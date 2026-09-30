import { getRecentRuns } from "@/db/verdict-repo";
import { getOrRefreshDailyVerdicts } from "@/lib/verdict/pipeline";
import { MatchResult } from "@/lib/verdict/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const marketBadgeClass = (verdict: string) => {
  if (verdict === "RETENU") return "bg-emerald-600 text-white";
  if (verdict === "SECONDAIRE") return "bg-amber-500 text-black";
  return "bg-slate-300 text-slate-900";
};

async function refreshAction() {
  "use server";
  await getOrRefreshDailyVerdicts({ force: true });
  revalidatePath("/");
}

function renderTable(title: string, matches: MatchResult[]) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {matches.length} match(s)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">1 / X / 2</th>
              <th className="px-3 py-2">Marché</th>
              <th className="px-3 py-2">Règles</th>
              <th className="px-3 py-2">Cote</th>
              <th className="px-3 py-2">Seuil</th>
              <th className="px-3 py-2">Verdict</th>
              <th className="px-3 py-2">Score match</th>
            </tr>
          </thead>
          <tbody>
            {matches.flatMap((match) => {
              if (!match.markets.length) {
                return [
                  <tr key={`${match.home}-${match.away}-none`} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{match.home} vs {match.away}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {match.odds["1"] ?? "-"} / {match.odds.X ?? "-"} / {match.odds["2"] ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-500" colSpan={5}>Aucun marché qualifiant</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{match.score.toFixed(2)}</td>
                  </tr>,
                ];
              }

              return match.markets.map((market, index) => (
                <tr key={`${match.home}-${match.away}-${market.key}-${index}`} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 font-medium text-slate-900">
                    <div>{match.home} vs {match.away}</div>
                    <div className="text-xs text-slate-500">{market.betLabel}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {match.odds["1"] ?? "-"} / {match.odds.X ?? "-"} / {match.odds["2"] ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-slate-800">{market.market}</td>
                  <td className="px-3 py-3 text-slate-600">{market.rules.length ? market.rules.join(", ") : "Signal"}</td>
                  <td className="px-3 py-3 text-slate-700">{market.odd ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{market.seuil ? market.seuil.toFixed(3) : "-"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${marketBadgeClass(market.verdict)}`}>
                      {market.verdict}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{match.score.toFixed(2)}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [daily, runs] = await Promise.all([getOrRefreshDailyVerdicts(), getRecentRuns()]);

  const clubFavorites = daily.club.filter((m) => m.hasQualifying).slice(0, 6);
  const selectionFavorites = daily.selection.filter((m) => m.hasQualifying).slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Moteur quotidien automatisé</p>
          <h1 className="mt-2 text-3xl font-bold">Verdict / Kimo&apos;s Predict</h1>
          <p className="mt-2 text-sm text-slate-300">
            Date UTC: <span className="font-semibold text-white">{daily.day}</span> ·
            Calculés: <span className="font-semibold text-white">{daily.computedCount}</span> ·
            Source: Sofascore API + moteur règles R1–R17
          </p>

          <form action={refreshAction} className="mt-4">
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Recalculer maintenant (script)
            </button>
          </form>
        </header>

        {renderTable("Favoris CLUB (top 6 qualifiants)", clubFavorites)}
        {renderTable("Favoris SÉLECTION (top 6 qualifiants)", selectionFavorites)}
        {renderTable("Tous les matchs CLUB", daily.club)}
        {renderTable("Tous les matchs SÉLECTION", daily.selection)}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Journal pipeline</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Date logique</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{new Date(run.createdAt).toUTCString()}</td>
                    <td className="px-3 py-2 text-slate-700">{run.day}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          run.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{run.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
