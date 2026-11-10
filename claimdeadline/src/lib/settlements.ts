import { databaseUrl, logError, query } from "./db";
import { todayInNewYork } from "./dates";
import { seedSettlements } from "./seed";
import type { Settlement } from "./types";

type EntryRow = {
  slug: string;
  name: string;
  payout_estimate: string | null;
  deadline: Date | string;
  deadline_note: string | null;
  proof_required: boolean | null;
  eligibility: string;
  claim_url: string;
  source_url: string;
  category: string;
  states: string[] | null;
  case_name: string | null;
  fund_amount: string | null;
  published_at: Date | string;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapRow(row: EntryRow): Settlement {
  return {
    slug: row.slug,
    name: row.name,
    payoutEstimate: row.payout_estimate,
    deadline: asDate(row.deadline),
    deadlineNote: row.deadline_note,
    proofRequired: row.proof_required,
    eligibility: row.eligibility,
    claimUrl: row.claim_url,
    sourceUrl: row.source_url,
    category: row.category,
    states: row.states ?? [],
    caseName: row.case_name,
    fundAmount: row.fund_amount,
    publishedAt: asDate(row.published_at),
  };
}

export async function listSettlements(): Promise<{
  settlements: Settlement[];
  source: "database" | "seed";
}> {
  if (!databaseUrl()) {
    return { settlements: seedSettlements(), source: "seed" };
  }
  const today = todayInNewYork();
  const rows = await query<EntryRow>(
    `SELECT slug, name, payout_estimate, deadline, deadline_note, proof_required,
            eligibility, claim_url, source_url, category, states, case_name,
            fund_amount, published_at
     FROM entries
     WHERE status = 'open' AND deadline >= $1::date
     ORDER BY deadline ASC, name ASC`,
    [today],
  );
  if (!rows) {
    await logError("settlements", "Falling back to seed JSON", "entries query failed");
    return { settlements: seedSettlements(), source: "seed" };
  }
  return { settlements: rows.map(mapRow), source: "database" };
}

export async function getSettlement(slug: string): Promise<Settlement | null> {
  const { settlements } = await listSettlements();
  return settlements.find((settlement) => settlement.slug === slug) ?? null;
}

export async function logZeroResult(
  filters: Record<string, unknown>,
): Promise<void> {
  if (!databaseUrl()) return;
  const queryText = String(filters.q ?? "").slice(0, 200);
  const ok = await query(
    `INSERT INTO zero_result_searches (query, filters) VALUES ($1, $2::jsonb)`,
    [queryText, JSON.stringify(filters)],
  );
  if (!ok) {
    await logError("search", "Could not log a zero-result search");
  }
}

export async function recordPageview(path: string): Promise<void> {
  if (!databaseUrl()) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const today = todayInNewYork();
  const ok = await query(
    `INSERT INTO pageviews (path, viewed_on, count)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (path, viewed_on)
     DO UPDATE SET count = pageviews.count + 1`,
    [path.slice(0, 300), today],
  );
  if (!ok) await logError("pageviews", `Could not count ${path}`);
}
