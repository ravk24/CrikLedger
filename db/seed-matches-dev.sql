-- ============================================================
-- LR-SuperGiants v0 — Match seed for UI verification (Feature 05)
-- The canonical example (kickoff §3): ground 2000 + balls 60,
-- 2 cars @ 250, 12 attendees -> fee 214, driver -36, collected
-- 2068, surplus 8. Plus one abandoned match.
-- Dev only — cleared before launch (Feature 17).
-- Phone numbers removed by migration 5 — players are name-only.
-- ============================================================

-- Six more players so the squad reaches 11 (12th attendee is a guest)
INSERT INTO players (name) VALUES
  ('Arif M.'),
  ('Deepak R.'),
  ('Karan P.'),
  ('Manoj B.'),
  ('Nikhil J.'),
  ('Rohit V.');

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id)
SELECT '2026-07-10', 'deposit', 'Opening deposit', 1000, id
FROM players WHERE name = 'Arif M.';

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id)
SELECT '2026-07-10', 'deposit', 'Opening deposit', 1000, id
FROM players WHERE name = 'Deepak R.';

-- The canonical completed match
INSERT INTO matches (id, match_date, opponent, status, result,
                     ground_fee, ball_fee, other_fee, car_allowance_per_car)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-08-09',
        'Andheri Warriors', 'completed', 'won', 2000, 60, 0, 250);

-- 11 self rows (Ramesh + Priya drove) + 1 guest hosted by Ramesh = 12 attendees
INSERT INTO match_participants (match_id, player_id, guest_name, brought_car, fee_amount)
SELECT '11111111-1111-4111-8111-111111111111', id, NULL,
       name IN ('Ramesh K.', 'Priya S.'),
       CASE WHEN name IN ('Ramesh K.', 'Priya S.') THEN -36 ELSE 214 END
FROM players
WHERE name IN ('Ramesh K.','Priya S.','Imran Q.','Sunil D.',
               'Vikram T.','Arif M.','Deepak R.','Karan P.',
               'Manoj B.','Nikhil J.','Rohit V.');

INSERT INTO match_participants (match_id, player_id, guest_name, brought_car, fee_amount)
SELECT '11111111-1111-4111-8111-111111111111', id, 'Arjun', FALSE, 214
FROM players WHERE name = 'Ramesh K.';

-- Auto surplus credit (v1 rule): collected 2068 - cash costs 2060 = 8.
-- Only the rounding surplus reaches the pool; fees stay on player balances.
INSERT INTO pool_entries (entry_date, kind, message, amount, match_id)
VALUES ('2026-08-09', 'match_collection',
        'Match surplus vs Andheri Warriors', 8,
        '11111111-1111-4111-8111-111111111111');

-- One abandoned match
INSERT INTO matches (match_date, opponent, status, abandoned_reason)
VALUES ('2026-08-02', 'Malad Strikers', 'abandoned', 'Rain, ground unplayable');
