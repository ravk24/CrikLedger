// Dev-tool: runs db/clear-dev-data.sql against DATABASE_URL (.env.local).
// Wipes every data table and keeps only the megaadmin account.
// Refuses to run without --confirm, and aborts if no megaadmin row exists
// (so a bad predicate can never leave the app with zero accounts).
// Usage: node db/reset.mjs --confirm
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found in .env.local");

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm. This deletes ALL data except the megaadmin.");
  process.exit(2);
}

const COUNT_TABLES = [
  "admins",
  "teams",
  "team_memberships",
  "players",
  "matches",
  "pool_entries",
  "tournaments",
  "tournament_players",
  "entitlements",
];

async function counts(client) {
  const out = {};
  for (const t of COUNT_TABLES) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${t}`);
    out[t] = rows[0].n;
  }
  return out;
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await client.connect();

console.log(`Target host: ${new URL(url).hostname}`);
console.log("Before:", await counts(client));

const { rows: mega } = await client.query(
  `SELECT username FROM admins WHERE platform_role = 'megaadmin'`,
);
if (mega.length !== 1) {
  console.error(`Expected exactly 1 megaadmin row, found ${mega.length}. Aborting.`);
  await client.end();
  process.exit(1);
}
console.log(`Keeping megaadmin: ${mega[0].username}`);

// The SQL file carries its own BEGIN/COMMIT; pg sends it as one multi-statement
// query, so a failure anywhere aborts the whole transaction server-side.
const sql = readFileSync(join(here, "clear-dev-data.sql"), "utf8");
try {
  await client.query(sql);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
  process.exit(1);
}

console.log("After: ", await counts(client));
const { rows: admins } = await client.query(
  `SELECT username, platform_role FROM admins ORDER BY username`,
);
console.log("Accounts:", admins);
await client.end();
