import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL or POSTGRES_URL before migrating.");
  process.exit(1);
}

const sql = readFileSync(path.join(import.meta.dirname, "..", "db", "schema.sql"), "utf8");
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query(sql);
  console.log("Schema is ready.");
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
