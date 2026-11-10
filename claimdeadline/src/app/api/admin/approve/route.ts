import { adminAuthorized, unauthorized } from "@/lib/admin";
import { databaseUrl, query } from "@/lib/db";
import { isHttpUrl, slugify } from "@/lib/site";

type Submission = {
  id: number;
  name: string;
  official_url: string;
  deadline: string | null;
  notes: string | null;
};

export async function POST(request: Request) {
  if (!adminAuthorized(request)) return unauthorized();
  if (!databaseUrl()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "id is required." }, { status: 400 });
  const found = await query<Submission>(
    `SELECT id, name, official_url, deadline::text, notes FROM submissions WHERE id = $1`,
    [id],
  );
  const submission = found?.[0];
  if (!found) return Response.json({ error: "Could not read the submission." }, { status: 500 });
  if (!submission) return Response.json({ error: "Submission not found." }, { status: 404 });

  const name = stringOr(body.name, submission.name).slice(0, 200);
  const claimUrl = stringOr(body.claimUrl, submission.official_url);
  const sourceUrl = stringOr(body.sourceUrl, submission.official_url);
  const eligibility = stringOr(body.eligibility, submission.notes ?? "See the official settlement site.");
  const deadline = stringOr(body.deadline, submission.deadline ?? "");
  const category = stringOr(body.category, "consumer");
  const slug = slugify(stringOr(body.slug, name));
  const payout = nullableString(body.payoutEstimate);
  const fund = nullableString(body.fundAmount);
  const caseName = nullableString(body.caseName);
  const proof =
    typeof body.proofRequired === "boolean" ? body.proofRequired : null;
  const states = Array.isArray(body.states)
    ? body.states.filter((item): item is string => typeof item === "string").slice(0, 60)
    : ["nationwide"];

  if (!isHttpUrl(claimUrl) || !isHttpUrl(sourceUrl)) {
    return Response.json({ error: "Claim and source URLs must be http(s)." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return Response.json({ error: "A YYYY-MM-DD deadline is required to approve." }, { status: 400 });
  }

  const created = await query<{ slug: string }>(
    `INSERT INTO entries (
       slug, name, payout_estimate, deadline, proof_required, eligibility,
       claim_url, source_url, category, states, case_name, fund_amount, published_at, status
     ) VALUES (
       $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_DATE, 'open'
     )
     ON CONFLICT (slug) DO NOTHING
     RETURNING slug`,
    [slug, name, payout, deadline, proof, eligibility.slice(0, 2000), claimUrl, sourceUrl, category, states, caseName, fund],
  );
  if (!created) return Response.json({ error: "Could not create the entry." }, { status: 500 });
  if (created.length === 0) {
    return Response.json({ error: "That slug already exists." }, { status: 409 });
  }
  await query(`UPDATE submissions SET status = 'approved' WHERE id = $1`, [id]);
  return Response.json({ ok: true, slug: created[0].slug });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}
