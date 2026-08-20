-- ============================================================
-- CrikLedger — Match seed for UI verification (Feature 05)
-- The canonical example (kickoff §3): ground 2000 + balls 60,
-- 2 cars @ 250, 12 attendees -> fee 214, driver -36, collected
-- 2068, surplus 8. Plus one abandoned match.
-- Dev only — cleared before launch (Feature 17).
--
-- Rewritten 2026-08-20 for the post-tenancy schema (the original
-- predated migration 26 and no longer ran): every row is scoped to
-- the 'our-xi' team, the guest lives in matches.guest_names with the
-- fee charged to the captain via guest_fee_share (migrations 6–7),
-- and ground is 'home' (migration 31). Run AFTER seed-dev.sql.
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
                     ground, guest_names, guest_cars, team_id)
SELECT '11111111-1111-4111-8111-111111111111', '2026-08-09',
       'Andheri Warriors', 'completed', 'won', 2000, 60, 0, 250,
       'home', ARRAY['Arjun'], ARRAY[FALSE], t.id
FROM teams t WHERE t.slug = 'our-xi';

-- 11 self rows: Ramesh + Priya drove (fee -36 = 214 - 250 rebate);
-- Ramesh (captain) also carries the guest's 214 as guest_fee_share.
INSERT INTO match_participants (match_id, player_id, brought_car, fee_amount,
                                guest_fee_share, team_id)
SELECT '11111111-1111-4111-8111-111111111111', id,
       name IN ('Ramesh K.', 'Priya S.'),
       CASE WHEN name IN ('Ramesh K.', 'Priya S.') THEN -36 ELSE 214 END,
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
INSERT INTO matches (match_date, opponent, status, abandoned_reason, ground, team_id)
SELECT '2026-08-02', 'Malad Strikers', 'abandoned', 'Rain, ground unplayable',
       'home', t.id
FROM teams t WHERE t.slug = 'our-xi';
