import { NextResponse } from "next/server";
import { databaseUrl, query } from "@/lib/db";
import { seedSettlements } from "@/lib/seed";
import { sponsorBySlug } from "@/lib/sponsors";

type ClaimRow = { claim_url: string };

async function claimUrl(slug: string): Promise<string | null> {
  if (!databaseUrl()) {
    return seedSettlements().find((item) => item.slug === slug)?.claimUrl ?? null;
  }
  const rows = await query<ClaimRow>(
    `SELECT claim_url FROM entries WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (!rows) {
    return seedSettlements().find((item) => item.slug === slug)?.claimUrl ?? null;
  }
  return rows[0]?.claim_url ?? null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const claim = await claimUrl(slug);
  const sponsor = claim ? null : await sponsorBySlug(slug);
  const target = claim ?? sponsor?.url ?? null;
  if (!target) {
    return NextResponse.json({ error: "Unknown link" }, { status: 404 });
  }
  if (databaseUrl()) {
    await query(
      `INSERT INTO sponsor_clicks (slug, kind, target_url) VALUES ($1, $2, $3)`,
      [slug, claim ? "claim" : "sponsor", target],
    );
  }
  return NextResponse.redirect(target, 302);
}
