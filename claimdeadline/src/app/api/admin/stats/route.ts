import { adminAuthorized, unauthorized } from "@/lib/admin";
import { databaseUrl, query } from "@/lib/db";
import { todayInNewYork } from "@/lib/dates";

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const today = todayInNewYork();
  const [signups, views, entries, clicks, pending, zero] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM signups`),
    query<{ count: string }>(
      `SELECT COALESCE(SUM(count), 0)::text AS count FROM pageviews WHERE viewed_on >= date_trunc('month', $1::date)::date`,
      [today],
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM entries WHERE status = 'open'`),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sponsor_clicks WHERE created_at >= date_trunc('month', $1::date)`,
      [today],
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM submissions WHERE status = 'pending'`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM zero_result_searches`),
  ]);
  if (!signups || !views || !entries || !clicks || !pending || !zero) {
    return Response.json({ error: "Could not read stats." }, { status: 500 });
  }
  return Response.json({
    subscribers: Number(signups[0].count),
    monthlyPageviews: Number(views[0].count),
    openEntries: Number(entries[0].count),
    monthlyClicks: Number(clicks[0].count),
    pendingSubmissions: Number(pending[0].count),
    zeroResultSearches: Number(zero[0].count),
  });
}
