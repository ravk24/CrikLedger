-- ============================================================
-- CrikLedger — Team superadmin seed (template, run manually)
--
-- Replace YOUR_STRONG_PASSWORD and the username/name/team slug
-- before running. Never commit a real password — this file is a
-- template, exactly like db/seed-superadmin.sql.
--
-- SUPERSEDED by the operator console (migration 37): /ops "Grant
-- Ledger" creates the account, the team and the entitlement in one
-- transaction. Keep this only as a break-glass template — and if you
-- do use it, insert a matching `entitlements` row or the team will
-- have a superadmin and no Ledger.
--
-- Why it existed: since migration 32 the megaadmin (ravi_kant) is
-- platform-level only and may not own or administer a team. Team
-- rights therefore need their own account.
--
-- What it does, in one transaction:
--   1. creates the account (platform_role 'user' — an ordinary human)
--   2. grants it a 'superadmin' membership on the named team
--   3. records it as the team's owner
--
-- Idempotent: re-running updates nothing and inserts nothing twice.
-- ============================================================

BEGIN;

INSERT INTO admins (username, name, password_hash, platform_role, must_change_password)
VALUES (
  'ravi_kant_SA',
  'Ravi (Our XI)',
  crypt('YOUR_STRONG_PASSWORD', gen_salt('bf')),
  'user',
  FALSE
)
ON CONFLICT (username) DO NOTHING;

-- Superadmin membership. admin_slot stays NULL — the two-admin
-- allowance belongs to team_role = 'admin' rows only.
INSERT INTO team_memberships (team_id, admin_id, team_role, created_by)
SELECT t.id, a.id, 'superadmin', a.id
FROM teams t, admins a
WHERE t.slug = 'our-xi' AND a.username = 'ravi_kant_SA'
ON CONFLICT (team_id, admin_id) DO NOTHING;

UPDATE teams t
   SET owner_admin_id = a.id
  FROM admins a
 WHERE t.slug = 'our-xi'
   AND a.username = 'ravi_kant_SA'
   AND t.owner_admin_id IS NULL;

COMMIT;

-- Verify:
-- SELECT a.username, a.platform_role, m.team_role, t.slug
--   FROM admins a
--   LEFT JOIN team_memberships m ON m.admin_id = a.id
--   LEFT JOIN teams t ON t.id = m.team_id
--  ORDER BY a.created_at;
--
-- The megaadmin must appear with NO membership row. If it ever has
-- one, that is a bug in the membership routes, not a data fix.
