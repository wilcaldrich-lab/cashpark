import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL or POSTGRES_URL before seeding.");
  process.exit(1);
}

const file = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "data", "settlements.json"), "utf8"),
);
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  let count = 0;
  for (const item of file.settlements) {
    await client.query(
      `INSERT INTO entries (
         slug, name, payout_estimate, deadline, deadline_note, proof_required,
         eligibility, claim_url, source_url, category, states, case_name,
         fund_amount, published_at, status
       ) VALUES (
         $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, 'open'
       )
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         payout_estimate = EXCLUDED.payout_estimate,
         deadline = EXCLUDED.deadline,
         deadline_note = EXCLUDED.deadline_note,
         proof_required = EXCLUDED.proof_required,
         eligibility = EXCLUDED.eligibility,
         claim_url = EXCLUDED.claim_url,
         source_url = EXCLUDED.source_url,
         category = EXCLUDED.category,
         states = EXCLUDED.states,
         case_name = EXCLUDED.case_name,
         fund_amount = EXCLUDED.fund_amount,
         published_at = EXCLUDED.published_at,
         status = 'open'`,
      [
        item.slug,
        item.name,
        item.payoutEstimate,
        item.deadline,
        item.deadlineNote,
        item.proofRequired,
        item.eligibility,
        item.claimUrl,
        item.sourceUrl,
        item.category,
        item.states,
        item.caseName,
        item.fundAmount,
        item.publishedAt,
      ],
    );
    count += 1;
  }
  console.log(`Upserted ${count} settlements.`);
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
