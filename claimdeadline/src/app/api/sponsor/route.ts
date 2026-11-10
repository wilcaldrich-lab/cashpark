import { databaseUrl, query } from "@/lib/db";
import { rejectEmail, normalizeEmail } from "@/lib/email-check";
import { sendOwnerEmail } from "@/lib/resend";
import { publicStats } from "@/lib/sponsors";

export async function GET() {
  const stats = await publicStats();
  return Response.json(stats);
}

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; organization?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const organization =
    typeof body.organization === "string" ? body.organization.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";
  if (name.length < 2) return Response.json({ error: "Add your name." }, { status: 400 });
  const emailError = rejectEmail(email);
  if (emailError) return Response.json({ error: emailError }, { status: 400 });
  if (message.length < 4) return Response.json({ error: "Add a short message." }, { status: 400 });
  if (!databaseUrl()) {
    return Response.json(
      { error: "The contact form needs a database. Try again after Postgres is connected." },
      { status: 503 },
    );
  }

  const saved = await query(
    `INSERT INTO sponsor_inquiries (name, email, organization, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, email, organization || null, message],
  );
  if (!saved) return Response.json({ error: "Could not save that note." }, { status: 500 });

  const mailed = await sendOwnerEmail(
    `ClaimDeadline sponsor inquiry from ${name}`,
    [`Name: ${name}`, `Email: ${email}`, `Organization: ${organization || "—"}`, "", message].join("\n"),
  );
  return Response.json({ ok: true, emailed: mailed.ok });
}
