import { databaseUrl, query } from "./db";
import { todayInNewYork } from "./dates";
import type { SponsorWeek } from "./types";

type SponsorRow = {
  id: number;
  slug: string;
  sponsor_name: string;
  tagline: string | null;
  url: string;
  week_start: Date | string;
  week_end: Date | string;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapSponsor(row: SponsorRow): SponsorWeek {
  return {
    id: row.id,
    slug: row.slug,
    sponsorName: row.sponsor_name,
    tagline: row.tagline,
    url: row.url,
    weekStart: asDate(row.week_start),
    weekEnd: asDate(row.week_end),
  };
}

export async function currentSponsor(): Promise<SponsorWeek | null> {
  if (!databaseUrl()) return null;
  const today = todayInNewYork();
  const rows = await query<SponsorRow>(
    `SELECT id, slug, sponsor_name, tagline, url, week_start, week_end
     FROM sponsor_weeks
     WHERE active = TRUE AND week_start <= $1::date AND week_end >= $1::date
     ORDER BY week_start DESC
     LIMIT 1`,
    [today],
  );
  return rows?.[0] ? mapSponsor(rows[0]) : null;
}

export async function sponsorBySlug(slug: string): Promise<SponsorWeek | null> {
  if (!databaseUrl()) return null;
  const rows = await query<SponsorRow>(
    `SELECT id, slug, sponsor_name, tagline, url, week_start, week_end
     FROM sponsor_weeks WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows?.[0] ? mapSponsor(rows[0]) : null;
}

export async function publicStats(): Promise<{
  subscribers: number;
  monthlyPageviews: number;
  database: boolean;
}> {
  if (!databaseUrl()) {
    return { subscribers: 0, monthlyPageviews: 0, database: false };
  }
  const today = todayInNewYork();
  const subscribers = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM signups`,
  );
  const views = await query<{ count: string }>(
    `SELECT COALESCE(SUM(count), 0)::text AS count
     FROM pageviews
     WHERE viewed_on >= date_trunc('month', $1::date)::date`,
    [today],
  );
  if (!subscribers || !views) {
    return { subscribers: 0, monthlyPageviews: 0, database: false };
  }
  return {
    subscribers: Number(subscribers[0]?.count ?? 0),
    monthlyPageviews: Number(views[0]?.count ?? 0),
    database: true,
  };
}
