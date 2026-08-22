# Operator runbook — activating a purchase by hand

CrikLedger V1 has no payment gateway. A customer pays the operator directly
(WhatsApp/UPI), and the operator turns that payment into an entitlement from
the operator console. This is the whole activation flow.

## Who can do this

Only the megaadmin account (`ravi_kant`). It reads every team and tournament
but writes none of their data; the grant below is the one thing it creates.

## Steps

1. **Verify the payment** out of band (bank/UPI statement). The customer
   sends their CrikLedger user id or email with the payment.
2. Open **`/ops`** (bottom tab **More → Operator console** when signed in as
   the megaadmin).
3. Pick the product:
   - **Grant Ledger** — the Team Ledger (₹ one-time). One per team; granting
     again for the same team is refused.
   - **Add tournament credit** — one credit hosts one tournament; credits
     stack, so grant once per purchase.
4. **One login per person.** The sheet opens on **Existing account**: search
   by user id, name or email, pick the customer (the row shows their team and
   what they already hold) and grant. The purchase attaches to that account
   and its team — no new password. Use **New account** only for a
   first-time customer: it asks for a user id and name, creates the account
   (and the team it will own), and shows a **one-time password — shown
   once**. If the id you type already exists, the sheet says so and blocks
   until you switch to Existing account.
5. Send a new customer their user id and one-time password (they must
   change it on first login). An existing customer needs nothing — the
   feature is live on their next page load.
6. The new holder appears in the **Ledger holders / Tournament credit**
   lists on `/ops` immediately; the customer sees the feature on their next
   page load.

Backend: `POST /api/ops/grants` (`app/api/ops/grants/route.ts`), one
transaction — account → owned team → `entitlements` row (migration 37).

## Refunds and removals

There is no self-serve refund. To withdraw a Ledger or credit, delete the
`entitlements` row by hand (see `CrikLedger-docs/06-database.md`) after the
money has been returned; the refund terms on `/refund-policy` are the
contract.

## Account problems

`/ops/accounts/<id>` offers **Reset password** (new one-time password, all
sessions signed out) and **Suspend / Restore**. Suspension is instant — the
session row is re-read on every request.

## What is deliberately absent in V1

- No analytics of any kind (PostHog was removed; `/privacy` states it).
- No automated emails — every credential is relayed by the operator.
- Database backups: GitHub Actions → *Daily DB Backup* (`db/BACKUP.md`).
  Run it manually before any migration.
