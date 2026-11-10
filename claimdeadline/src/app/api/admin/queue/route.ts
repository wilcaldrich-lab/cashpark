import { adminAuthorized, unauthorized } from "@/lib/admin";
import { databaseUrl, query } from "@/lib/db";

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const rows = await query(
    `SELECT id, name, official_url, deadline, notes, status, created_at
     FROM submissions
     WHERE status = 'pending'
     ORDER BY created_at ASC`,
  );
  if (!rows) return Response.json({ error: "Could not read the queue." }, { status: 500 });
  return Response.json({ submissions: rows });
}
