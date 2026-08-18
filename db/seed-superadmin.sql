-- ============================================================
-- CrikLedger — Megaadmin seed (run ONCE, at bootstrap)
--
-- Replace YOUR_STRONG_PASSWORD before running. Never commit a real
-- password here — this file is a template.
--
-- Since migration 32 this seeds the PLATFORM operator, not a team
-- admin. The megaadmin reads everything (to reproduce user-reported
-- bugs) and writes nothing on customer data, and must never hold a
-- team or tournament membership. Team rights need a separate
-- account — see db/seed-team-superadmin.sql.
-- ============================================================

INSERT INTO admins (username, name, password_hash, platform_role, must_change_password)
VALUES (
  'ravi_kant',
  'Ravi',
  crypt('YOUR_STRONG_PASSWORD', gen_salt('bf')),
  'megaadmin',
  FALSE
);

-- Rotating the megaadmin password later (never in a migration):
-- UPDATE admins
--    SET password_hash = crypt('NEW_STRONG_PASSWORD', gen_salt('bf')),
--        session_epoch = session_epoch + 1   -- kills outstanding sessions
--  WHERE username = 'ravi_kant';
