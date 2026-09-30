import { runDailyPipeline } from "@/lib/verdict/pipeline";

export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (secret && bearer !== secret) {
    return unauthorized();
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { day?: string };
    const data = await runDailyPipeline(body.day);
    return Response.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
