-- ============================================================
-- LR-SuperGiants v0 — Migration 3: matches_public view
-- Adds admin-name resolution for the "Last updated by" stamp —
-- anon cannot join the admins base table, so the view does it.
-- ============================================================

CREATE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

GRANT SELECT ON matches_public TO anon;
