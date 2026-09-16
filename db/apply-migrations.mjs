// Dev-tool: applies db/migration-*.sql to the database in DATABASE_URL (.env.local).
// - Tracks applied files in a _migrations table; reruns skip what's already applied.
// - Migrations 4 and 8 must run statement-by-statement (ALTER TYPE ... ADD VALUE cannot
//   share a transaction with statements that use the new value), so those files are split
//   and each statement runs in its own autocommit query. Everything else runs per-file.
// - Migration files themselves stay immutable; this script only reads them.
// Usage: node db/apply-migrations.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found in .env.local");

// These files contain ALTER TYPE ... ADD VALUE and must run in autocommit, one
// statement at a time (their headers say "run statement-by-statement").
const AUTOCOMMIT_FILES = new Set([
  "migration-4.sql",
  "migration-8.sql",
  "migration-54.sql",
  "migration-55.sql",
]);

// Split SQL into statements on top-level semicolons (tracks quotes, dollar-quotes
// and line comments — enough for this repo's plain-DDL migrations).
function splitStatements(sql) {
  const out = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let inLineComment = false;
  let dollarTag = null;
  while (i < sql.length) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);
    if (inLineComment) {
      cur += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (dollarTag) {
      cur += ch;
      if (sql.startsWith(dollarTag, i)) {
        cur += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
      } else i++;
      continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          cur += "'";
          i++; // escaped quote ('') — still inside the string
        } else {
          inSingle = false;
        }
      }
      i++;
      continue;
    }
    if (two === "--") { inLineComment = true; cur += ch; i++; continue; }
    if (ch === "'") { inSingle = true; cur += ch; i++; continue; }
    const dollarMatch = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollarMatch) { dollarTag = dollarMatch[0]; cur += dollarTag; i += dollarTag.length; continue; }
    if (ch === ";") {
      const stmt = cur.trim();
      if (stmt.replace(/--.*$/gm, "").trim()) out.push(stmt);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const tail = cur.trim();
  if (tail.replace(/--.*$/gm, "").trim()) out.push(tail);
  return out;
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await client.connect();

await client.query(
  `CREATE TABLE IF NOT EXISTS _migrations (
     filename TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
);

const files = readdirSync(here)
  .filter((f) => /^migration-\d+\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

const { rows } = await client.query(`SELECT filename FROM _migrations`);
const done = new Set(rows.map((r) => r.filename));

let applied = 0;
for (const file of files) {
  if (done.has(file)) {
    console.log(`skip   ${file}`);
    continue;
  }
  const sql = readFileSync(join(here, file), "utf8");
  try {
    if (AUTOCOMMIT_FILES.has(file)) {
      for (const stmt of splitStatements(sql)) await client.query(stmt);
    } else {
      await client.query(sql);
    }
  } catch (err) {
    console.error(`FAILED ${file}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
  await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
  console.log(`apply  ${file}`);
  applied++;
}

console.log(`Done. ${applied} applied, ${done.size} previously applied, ${files.length} total.`);
await client.end();
