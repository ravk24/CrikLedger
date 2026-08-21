-- ============================================================
-- CrikLedger — migration 38: retire the "Our XI" placeholder
--
-- The superadmin rename (api/sa/team) now writes short_name alongside
-- display_name, because match titles read short_name first. Teams
-- renamed before this change still carry the seeded short_name, and
-- the seeded superadmin account name carries the same suffix.
-- ============================================================

UPDATE teams
SET short_name = display_name
WHERE short_name = 'Our XI';

UPDATE admins
SET name = regexp_replace(name, '\s*\(Our XI\)$', '')
WHERE name LIKE '%(Our XI)';
