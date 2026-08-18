-- ============================================================
-- LR-SuperGiants v1 — Migration 9: opening dues count against
-- the pool running total
--
-- The pool page shows opening_due rows as negative amounts, so
-- the running-total bar must be the signed sum of what is
-- displayed — migration-8's exclusion made the bar disagree with
-- the ledger above it. A settling deposit (+) later cancels the
-- due (-), so settled dues net to zero in the total.
-- ============================================================

CREATE OR REPLACE VIEW pool_balance AS
SELECT COALESCE(SUM(amount), 0) AS balance
FROM pool_entries;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
