import { databaseUrl, query } from "@/lib/db";
import { isHttpUrl } from "@/lib/site";

export async function POST(request: Request) {
  let body: { name?: unknown; officialUrl?: unknown; deadline?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const officialUrl = typeof body.officialUrl === "string" ? body.officialUrl.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 5000) : "";
  const deadline = typeof body.deadline === "string" ? body.deadline : "";
  if (name.length < 2) return Response.json({ error: "Add a settlement name." }, { status: 400 });
  if (!isHttpUrl(officialUrl)) {
    return Response.json({ error: "Official URL must start with http:// or https://." }, { status: 400 });
  }
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return Response.json({ error: "Deadline must be a date." }, { status: 400 });
  }
  if (!databaseUrl()) {
    return Response.json(
      { error: "Submissions need a database. Try again after Postgres is connected." },
      { status: 503 },
    );
  }
  const rows = await query(
    `INSERT INTO submissions (name, official_url, deadline, notes)
     VALUES ($1, $2, $3::date, $4)
     RETURNING id`,
    [name, officialUrl, deadline || null, notes || null],
  );
  if (!rows) return Response.json({ error: "Could not save that submission." }, { status: 500 });
  return Response.json({ ok: true });
}
