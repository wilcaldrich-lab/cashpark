import { adminAuthorized, unauthorized } from "@/lib/admin";
import { databaseUrl, query } from "@/lib/db";
import { isHttpUrl, slugify } from "@/lib/site";

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const rows = await query(
    `SELECT id, slug, sponsor_name, tagline, url, week_start, week_end, active, created_at
     FROM sponsor_weeks
     ORDER BY week_start DESC`,
  );
  if (!rows) return Response.json({ error: "Could not read sponsors." }, { status: 500 });
  return Response.json({ sponsors: rows });
}

export async function POST(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const sponsorName = typeof body.sponsorName === "string" ? body.sponsorName.trim().slice(0, 200) : "";
  const tagline = typeof body.tagline === "string" ? body.tagline.trim().slice(0, 240) : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : sponsorName);
  const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
  const weekEnd = typeof body.weekEnd === "string" ? body.weekEnd : "";
  const active = body.active === false ? false : true;
  if (!sponsorName || !isHttpUrl(url)) {
    return Response.json({ error: "sponsorName and an http(s) url are required." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
    return Response.json({ error: "weekStart and weekEnd must be YYYY-MM-DD." }, { status: 400 });
  }
  const rows = await query(
    `INSERT INTO sponsor_weeks (slug, sponsor_name, tagline, url, week_start, week_end, active)
     VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
     ON CONFLICT (slug) DO UPDATE SET
       sponsor_name = EXCLUDED.sponsor_name,
       tagline = EXCLUDED.tagline,
       url = EXCLUDED.url,
       week_start = EXCLUDED.week_start,
       week_end = EXCLUDED.week_end,
       active = EXCLUDED.active
     RETURNING id, slug`,
    [slug, sponsorName, tagline || null, url, weekStart, weekEnd, active],
  );
  if (!rows) return Response.json({ error: "Could not save the sponsor week." }, { status: 500 });
  return Response.json({ ok: true, sponsor: rows[0] });
}
