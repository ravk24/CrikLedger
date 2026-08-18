-- ============================================================
-- LR-SuperGiants v0 — Superadmin seed (run ONCE)
-- Replace YOUR_STRONG_PASSWORD before running. Never commit a
-- real password here — this file is a template.
-- ============================================================

INSERT INTO admins (username, name, password_hash, role, must_change_password)
VALUES (
  'ravi_kant',
  'Ravi',
  crypt('YOUR_STRONG_PASSWORD', gen_salt('bf')),
  'superadmin',
  FALSE
);
