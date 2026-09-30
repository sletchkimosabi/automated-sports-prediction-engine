import { getOrRefreshDailyVerdicts } from "@/lib/verdict/pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";

  try {
    const data = await getOrRefreshDailyVerdicts({ force });
    return Response.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
