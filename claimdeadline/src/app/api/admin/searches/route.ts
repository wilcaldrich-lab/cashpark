import { adminAuthorized, unauthorized } from "@/lib/admin";
import { databaseUrl, query } from "@/lib/db";

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const rows = await query(
    `SELECT id, query, filters, created_at
     FROM zero_result_searches
     ORDER BY created_at DESC
     LIMIT 200`,
  );
  if (!rows) return Response.json({ error: "Could not read searches." }, { status: 500 });
  return Response.json({ searches: rows });
}
