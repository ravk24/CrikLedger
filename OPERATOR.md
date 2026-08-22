# Operator runbook — activating a purchase by hand

CrikLedger V1 has no payment gateway. A customer pays the operator directly
(WhatsApp/UPI), and the operator turns that payment into an entitlement from
the operator console. This is the whole activation flow.

## Who can do this

Only the megaadmin account (`ravi_kant`). It reads every team and tournament
but writes none of their data; the grant below is the one thing it creates.

## Steps

1. **Verify the payment** out of band (bank/UPI statement). Note the
   customer's CrikLedger user id if they already signed up, or the name and
   user id they want if not.
2. Open **`/ops`** (bottom tab **More → Operator console** when signed in as
   the megaadmin).
3. Pick the product:
   - **Grant Ledger** — the Team Ledger (₹ one-time). One per team; granting
     again for the same team is refused.
   - **Grant Tournament credit** — one credit hosts one tournament; credits
     stack, so grant once per purchase.
4. In the sheet, enter the **user id**. If the id does not exist yet the
   console creates the account (and, for a Ledger, the team it will own with
   a superadmin membership) and shows a **one-time password — it is shown
   once**. Copy it before closing the sheet.
5. Send the customer their user id and, for a new account, the one-time
   password. They are forced to change it on first login.
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
