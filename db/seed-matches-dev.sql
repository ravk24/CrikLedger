-- ============================================================
-- CrikLedger — Match seed for UI verification (Feature 05)
-- The canonical example (engine/calc.ts): ground 2000 + balls 60,
-- 2 cars @ 250, 12 heads all sharing -> base CEIL(2060/12) = 172 +
-- car CEIL(500/12) = 42 = 214 a rider, drivers 214 - 250 = -36
-- ("gets ₹36"), collected 2068, surplus 8. Plus one abandoned match.
-- Dev only — cleared before launch (Feature 17).
--
-- Rewritten 2026-08-20 for the post-tenancy schema (the original
-- predated migration 26 and no longer ran): every row is scoped to
-- the 'our-xi' team, the guest lives in matches.guest_names with the
-- fee charged to the captain via guest_fee_share (migrations 6–7),
-- and matches carry a free-text venue (matches.ground was dropped in
-- migration 35). Run AFTER seed-dev.sql.
-- ============================================================

-- Six more players so the squad reaches 11 (12th attendee is a guest)
INSERT INTO players (name, team_id)
SELECT p.name, t.id
FROM teams t,
     (VALUES ('Arif M.'), ('Deepak R.'), ('Karan P.'),
             ('Manoj B.'), ('Nikhil J.'), ('Rohit V.')) AS p(name)
WHERE t.slug = 'our-xi';

-- Captain & vice-captain (guest fees are charged to the captain)
UPDATE players SET is_captain = TRUE
WHERE name = 'Ramesh K.'
  AND team_id = (SELECT id FROM teams WHERE slug = 'our-xi');
UPDATE players SET is_vice_captain = TRUE
WHERE name = 'Priya S.'
  AND team_id = (SELECT id FROM teams WHERE slug = 'our-xi');

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, team_id)
SELECT '2026-07-10', 'deposit', 'Opening deposit', 1000, id, team_id
FROM players WHERE name = 'Arif M.';

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, team_id)
SELECT '2026-07-10', 'deposit', 'Opening deposit', 1000, id, team_id
FROM players WHERE name = 'Deepak R.';

-- The canonical completed match. Guest 'Arjun' is display-only
-- (guest_names); his 214 re-enters the split via the captain's
-- guest_fee_share row below.
INSERT INTO matches (id, match_date, opponent, status, result,
                     ground_fee, ball_fee, other_fee, car_allowance_per_car,
                     venue, guest_names, guest_cars, guest_shared_cars, team_id)
SELECT '11111111-1111-4111-8111-111111111111', '2026-08-09',
       'Andheri Warriors', 'completed', 'won', 2000, 60, 0, 250,
       'Barne, Pusane', ARRAY['Arjun'], ARRAY[FALSE], ARRAY[TRUE], t.id
FROM teams t WHERE t.slug = 'our-xi';

-- 11 self rows, everyone shared a car (shared_car TRUE, drivers included):
-- Ramesh + Priya drove (own fee -36 = 214 - 250 rebate). Ramesh
-- (captain) also carries the guest's 214 as guest_fee_share, so his
-- stored fee_amount is -36 + 214 = 178 — completeMatch merges the guest
-- charge into the captain's row, and SUM(fee_amount) must be 2068.
INSERT INTO match_participants (match_id, player_id, brought_car, shared_car,
                                fee_amount, guest_fee_share, team_id)
SELECT '11111111-1111-4111-8111-111111111111', id,
       name IN ('Ramesh K.', 'Priya S.'),
       TRUE,
       CASE WHEN name = 'Ramesh K.' THEN 178
            WHEN name = 'Priya S.' THEN -36
            ELSE 214 END,
       CASE WHEN name = 'Ramesh K.' THEN 214 ELSE 0 END,
       team_id
FROM players
WHERE name IN ('Ramesh K.','Priya S.','Imran Q.','Sunil D.',
               'Vikram T.','Arif M.','Deepak R.','Karan P.',
               'Manoj B.','Nikhil J.','Rohit V.')
  AND team_id = (SELECT id FROM teams WHERE slug = 'our-xi');

-- Auto surplus credit (v1 rule): collected 2068 - cash costs 2060 = 8.
-- Only the rounding surplus reaches the pool; fees stay on player balances.
INSERT INTO pool_entries (entry_date, kind, message, amount, match_id, team_id)
SELECT '2026-08-09', 'match_collection',
       'Match surplus vs Andheri Warriors', 8,
       '11111111-1111-4111-8111-111111111111', t.id
FROM teams t WHERE t.slug = 'our-xi';

-- One abandoned match
INSERT INTO matches (match_date, opponent, status, abandoned_reason, venue, team_id)
SELECT '2026-08-02', 'Malad Strikers', 'abandoned', 'Rain, ground unplayable',
       'Barne, Pusane', t.id
FROM teams t WHERE t.slug = 'our-xi';
