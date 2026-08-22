// One-off repair: fold a mistakenly duplicated customer account into the
// real one. Dry run by default; pass --apply to execute.
//
//   node scripts/repair-duplicate-account.mjs <duplicate_username> <keep_username> [--apply]
//
// Moves the duplicate's UNCONSUMED entitlements onto the kept account's
// owned team, removes the duplicate's empty team + membership, and
// suspends the duplicate login. Refuses if the duplicate's team holds any
// data (matches, players, tournaments) or a consumed credit — those need
// a human decision.
import { readFileSync } from "node:fs";
import pg from "pg";

const [dup, keep, flag] = process.argv.slice(2);
if (!dup || !keep) {
  console.error("usage: node scripts/repair-duplicate-account.mjs <duplicate_username> <keep_username> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found in .env.local");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const acct = async (u) =>
    (await c.query(`SELECT id, username, name, platform_role, is_active FROM admins WHERE username = $1`, [u])).rows[0];
  const d = await acct(dup);
  const k = await acct(keep);
  if (!d || !k) throw new Error(`account not found: ${!d ? dup : keep}`);
  if (d.platform_role === "megaadmin" || k.platform_role === "megaadmin") throw new Error("refusing to touch a megaadmin");

  const team = async (adminId) =>
    (await c.query(`SELECT id, slug, display_name FROM teams WHERE owner_admin_id = $1 ORDER BY created_at LIMIT 1`, [adminId])).rows[0];
  const dt = await team(d.id);
  const kt = await team(k.id);
  if (!kt) throw new Error(`${keep} owns no team — nothing to move the purchase onto`);

  const ents = (await c.query(
    `SELECT id, product, consumed_at FROM entitlements WHERE admin_id = $1 ORDER BY created_at`, [d.id])).rows;
  const consumed = ents.filter((e) => e.consumed_at);
  if (consumed.length) throw new Error(`${dup} has ${consumed.length} consumed credit(s) — a tournament was run on the duplicate team; stop and decide by hand`);

  let data = { matches: 0, players: 0, tournaments: 0, admins: 0 };
  if (dt) {
    const q = async (sql) => Number((await c.query(sql, [dt.id])).rows[0].n);
    data = {
      matches: await q(`SELECT count(*) n FROM matches WHERE team_id = $1`),
      players: await q(`SELECT count(*) n FROM players WHERE team_id = $1`),
      tournaments: await q(`SELECT count(*) n FROM tournaments WHERE team_id = $1`),
      admins: await q(`SELECT count(*) n FROM team_memberships WHERE team_id = $1 AND admin_id <> '${d.id}'`),
    };
    if (Object.values(data).some((n) => n > 0)) throw new Error(`duplicate team ${dt.slug} holds data ${JSON.stringify(data)} — refusing`);
  }

  console.log(`Duplicate: ${d.username} (${d.name}) team=${dt?.slug ?? "none"} entitlements=${ents.map((e) => e.product).join(",") || "none"}`);
  console.log(`Keep:      ${k.username} (${k.name}) team=${kt.slug} "${kt.display_name}"`);
  console.log(`Plan: move ${ents.length} entitlement(s) -> ${kt.slug}; ${dt ? `delete team ${dt.slug} + membership; ` : ""}suspend ${d.username}`);
  if (!apply) { console.log("(dry run — pass --apply to execute)"); process.exit(0); }

  await c.query("BEGIN");
  const moved = await c.query(
    `UPDATE entitlements SET team_id = $1, admin_id = $2,
            note = coalesce(note || ' · ', '') || 'moved from duplicate ' || $3 || ' ' || current_date
      WHERE admin_id = $4 AND consumed_at IS NULL`, [kt.id, k.id, d.username, d.id]);
  if (dt) {
    await c.query(`DELETE FROM team_memberships WHERE team_id = $1`, [dt.id]);
    await c.query(`DELETE FROM teams WHERE id = $1`, [dt.id]);
  }
  await c.query(`UPDATE admins SET is_active = FALSE, session_epoch = session_epoch + 1 WHERE id = $1`, [d.id]);
  await c.query("COMMIT");
  console.log(`Done: moved ${moved.rowCount} entitlement(s); ${dt ? `deleted team ${dt.slug}; ` : ""}suspended ${d.username}.`);
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ABORTED:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
