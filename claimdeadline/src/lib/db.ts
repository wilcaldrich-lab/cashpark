import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let poolFailed = false;

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function getPool(): Pool | null {
  const url = databaseUrl();
  if (!url || poolFailed) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", () => {
      poolFailed = true;
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[] | null> {
  const active = getPool();
  if (!active) return null;
  try {
    const result = await active.query<T>(text, params);
    return result.rows;
  } catch (error) {
    console.error("database query failed", error);
    return null;
  }
}

export async function logError(
  source: string,
  message: string,
  detail?: string,
): Promise<void> {
  if (!databaseUrl()) return;
  try {
    await query(
      `INSERT INTO errors (source, message, detail) VALUES ($1, $2, $3)`,
      [source.slice(0, 120), message.slice(0, 2000), detail?.slice(0, 8000) ?? null],
    );
  } catch {
    // Avoid a loop if the errors table itself is unavailable.
  }
}
