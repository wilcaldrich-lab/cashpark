import { databaseUrl, logError, query } from "@/lib/db";
import { normalizeEmail, rejectEmail } from "@/lib/email-check";
import { addToResendAudience } from "@/lib/resend";

export async function POST(request: Request) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const reason = rejectEmail(email);
  if (reason) return Response.json({ error: reason }, { status: 400 });
  if (!databaseUrl()) {
    return Response.json(
      { error: "Email signup needs a database. Try again after Postgres is connected." },
      { status: 503 },
    );
  }
  const source = typeof body.source === "string" ? body.source.slice(0, 120) : "site";

  const inserted = await query<{ id: number }>(
    `INSERT INTO signups (email, source)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, source],
  );
  if (!inserted) {
    await logError("subscribe", "Could not store signup");
    return Response.json({ error: "Could not save that email." }, { status: 500 });
  }

  const resend = await addToResendAudience(email);
  if (!resend.ok && !resend.skipped) {
    return Response.json(
      { ok: true, stored: true, resend: false, warning: resend.detail },
      { status: 200 },
    );
  }
  return Response.json({
    ok: true,
    stored: true,
    alreadySubscribed: inserted.length === 0,
    resend: resend.ok ? "added" : "skipped",
  });
}
