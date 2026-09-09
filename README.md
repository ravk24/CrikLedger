# CrikLedger

A mobile-first web app that manages a **cricket team's money** — match fee splitting, a shared team fund (pool), and per-player balances. A team's data is private to its members; completed match sheets stay shareable by link. No payments happen in the app — all money moves offline, and the app is the single source-of-truth ledger.

**Status:** CrikLedger v1.1 — core app running on the dev DB (2026-08-17); multi-team generalization next. Born from the LR-SuperGiants team ledger.

---

## What it does

### Match fee engine

When a match is completed, an admin enters the costs (ground fee, ball cost, other/misc cost, car allowance per car), selects the participating players, records any guest names, tags who brought cars (guest cars included), and unticks anyone who made their own way. The rule (`engine/calc.ts`, locked 2026-08-25):

```
Heads        = Players + Guests
Base         = Ground Fee + Ball Cost + Other Cost
Car pot      = Car Allowance × Cars
Sharers      = everyone who rode in a car — DRIVERS INCLUDED (only "own way" people are left out)
Base share   = CEILING(Base ÷ Heads)                       ← rounded UP to whole rupee
Car share    = CEILING(Car pot ÷ Sharers)                   ← ONE pot, split evenly; never per car
Rider        = Base share + Car share
Own way      = Base share
Driver       = Base share + Car share − Car Allowance      ← can be negative: "gets ₹x"
Total shown  = Base + Car pot
Surplus      = Collected − Base                             ← the two ceiling remainders, always ≥ 0
```

Worked: ground 2,500 + balls 60, 3 cars @ ₹250, 11 players + 2 guests, everyone shared → base 197, car CEIL(750 ÷ 13) = 58, riders **₹255**, drivers **₹5**, surplus ₹5. Same match with the two guests unticked → 11 sharers, car 69, riders ₹266, drivers ₹16, guests ₹197, surplus ₹10.

- Rounding always favors the pool — the small ceiling surplus is auto-credited to the team fund. Match fees themselves stay on player balances; besides this credit and the away-match ground-fee flow (below), every pool credit/debit is entered manually by an admin.
- Fees are computed server-side from attendance; the wizard preview runs the same engine in the browser and nothing is editable by hand.
- **Guests** count in the split like players, and their charges land on the **standing captain's balance** — merged into the captain's own fee row when they play, or a charge-only row when they don't. Guests hand the captain cash offline; the app never bills a guest directly. Guest drivers get the same car-allowance credit, which reduces the captain's charge.
- On submit, one database transaction updates the match, writes the final fee rows, and auto-credits the pool with the rounding surplus (collected − cash costs). If admin edits erase the surplus, no pool entry is created.
- **Away (Other) matches**: the pool fronts the team's ground-fee contribution when the match is scheduled (a linked debit), and the completion credit recoups it on top of the surplus (collected − cash costs + contribution). Abandoning, cancelling, or deleting the match returns the fee to the pool. Barne matches never touch money at scheduling — the season's slots were block-paid up front.

### Pool (team fund) ledger

One unified, chronological ledger with a running balance:

| Entry | Created by | Effect |
|---|---|---|
| Credit — player deposit | Admin | Pool ↑ and that player's balance ↑ |
| Credit — ground booking | Admin | Pool ↑ by the amount paid; records team, captain, slots, and pending amount, and schedules one match per booked date in the same transaction. Deleting a booked match returns that slot's share to the pool automatically |
| Credit — other income | Admin | Pool ↑ |
| Credit — match collection | **App, automatically** on match submit | Pool ↑ by the rounding surplus — plus, for an away (Other) match, the ground fee the pool fronted at scheduling (recouped from player fees) |
| Debit — away-match ground fee | **App** when an Other match is scheduled | Pool ↓ by the team's contribution (a linked `plain_debit`); returns to the pool automatically if the match is abandoned, cancelled, or deleted |
| Debit — plain (ground booking, misc) | Admin | Pool ↓ |
| Debit — common (team gear: bats, stumps…) | Admin | Pool ↓, each active player charged `CEILING(amount ÷ active players)` on their balance — nothing auto-credited back |
| Debit — season opening due | Admin | Pool ↓ and that player's balance ↓ (season-1 debt carryforward; a later settling deposit cancels it). Entered from the Credit sheet as "Last season due" |

The admin Credit sheet offers: Player deposit · Ground booking · Other income · Last season due. (An `equipment` credit kind existed earlier and was removed from the sheet; old rows still render with an EQUIPMENT chip.)

**Export.** Any admin of the team can download the whole ledger as an Excel workbook from the spreadsheet icon in the `/pool` toolbar (`GET /api/export/ledger`): a **Ledger** sheet oldest-first with a running balance that ends on the pool balance, a **Balances** sheet in dashboard order, and a **Statements** sheet with every player's statement rows. Dates are real date cells and amounts are numbers, so the file sorts and filters in Excel or Google Sheets. It is built server-side with ExcelJS from the same views the pages read — no money is recomputed.

> **Note on the match surplus:** it is credited when fees are *charged* to player balances, not when the cash arrives, so the pool total can run slightly ahead of the physical cash box — bounded by the sum of all surpluses (a few rupees per match). This is intentional: the surplus is the team's small discretionary fund (gear, tea/coffee party), and exact cash reconciliation is not a goal.

### Player balances

Balances are **always derived** from the ledger — there is no stored balance column. Each player has a public statement page showing every deposit, match fee, guest fee (captain), driver rebate, expense share, and season opening due with a running balance. Status colors: green (≥ ₹900), orange (₹0–₹899), red (in debt), grey (inactive).

### Roles

Since Feature 4 (migration 32), power comes from **membership rows**, not from
the account: a person may be superadmin of their own team and an admin on
someone else's. Each purchase grants one scope — a team or a tournament — with
its own allowance of 2 admins.

| Role | Access |
|---|---|
| **Guest** | No login. Browses the app, completes and shares a sample match, and views a sample ledger — all from fixed example data. Sees team and tournament titles, nothing more. |
| **Signed in** | An account with no purchases: the same as a guest, plus a Purchases page. |
| **Admin** | Per team or tournament, at most 2 per scope, provisioned by that scope's superadmin with a one-time password. Schedules/completes/edits/abandons matches, manages pool entries and players — **for that scope only**. |
| **Team viewer** | One shared **read-only** login per team, created by the superadmin (migration 49), who chooses both its user id and its password. **One player at a time** (migration 50): while someone is signed in, the next sign-in is refused with a message naming the superadmin who can force it free, or asking the signed-in player to log out in the WhatsApp group. The viewer sees everything a member sees — balances, ledger, schedule, match sheets, statements, the team's tournaments — but nothing they can change: no credit/debit, no scheduling, no share images or export, no password change, no purchases. The superadmin can **sign out the viewer** (same password still works), **reset the password**, or **remove** the login from Manage admins. |
| **Superadmin** | The purchaser of a scope. Everything above, plus creating/revoking its admins and resetting their passwords, and the team viewer login. One scope per purchase. |
| **Megaadmin** | The platform operator (`ravi_kant`). **Reads every team and tournament, writes none** — an observer, so a console bug cannot corrupt a customer's ledger. Holds no membership and cannot: team rights need a separate account. Owns `/ops`: grants (Ledger / tournament credits — see `OPERATOR.md`), accounts, password resets and suspensions. |
| **Captain** | Not a login — a player flag (at most one per team, declared by the superadmin). All guest charges land on the captain's balance; the captain settles guest cash offline. |

**Public by link:** a *completed* match sheet, so it can be shared to WhatsApp
with players who have no account. Everything else team-scoped — ledger, pool,
statements, slots, players, tournaments — requires a session whose membership
matches. That is enforced by revoking the anon role (migration 33), not only by
the UI: server components read the views with the service role, which never
reaches the browser.

---

## Pages

| Route | Page |
|---|---|
| `/` | Dashboard — animated pool balance card + searchable player balance grid, lowest balance first |
| `/schedule` | Hub — Schedule match, Upcoming, Completed |
| `/schedule/upcoming` | Scheduled matches, month-grouped, with a filter (All / No Opponent / Pending Fee) |
| `/schedule/completed` | Played and abandoned matches, newest first, with result badges |
| `/matches/[id]` | Match detail — fee table, share sheet, admin actions; back link returns to Upcoming or Completed by status |
| `/more` | App drawer — Car Fee Calculator, Car Counter, and Share with a friend live; Tournament tile reserved for v2 |
| `/car-fee` | Car Fee Calculator — enter the Google Maps distance (starting location → ground), fee = CEILING(2 × distance × ₹9.6/km) |
| `/car-count` | Car Counter — active players with how many times each brought a car (derived from match participation) |
| `/matches/[id]` | Match detail — fee table, cost breakdown, surplus to pool |
| `/pool` | Team fund ledger (+ Credit/Debit, share-image and Excel-export buttons when logged in as admin) |
| `/players/[id]` | Public player statement with running balance |
| `/admin` | Admin console — schedule match, 6-step complete-match wizard (result → costs → players → guests → cars → fee preview), edit/abandon |
| `/admin/players` | Player management (add, edit, activate/deactivate) |
| `/admin/manage` | Superadmin panel (admin accounts) |

The app is installable as a **PWA** (web manifest + install nudge) and designed mobile-first: bottom sheets, one-step-per-screen wizard, sticky balance summary, large tap targets.

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) — public pages are server components; all writes go through API route handlers |
| Database | Supabase Postgres 15+ (database only — Supabase Auth is **not** used) |
| Writes | `pg` (node-postgres) via the transaction pooler — one transaction per money operation |
| Auth | Custom: bcrypt hashes (pgcrypto) in an `admins` table + jose-signed httpOnly JWT cookie |
| Public reads | Supabase anon client, restricted by RLS to purpose-built public views only |
| UI | Tailwind CSS v4, shadcn/ui, Framer Motion (pool counter + badges), next-themes |
| Validation | Zod schemas for every route body |
| Testing | Vitest — the money engine is unit-tested before any UI |
| Hosting | Vercel (daily cron keepalive to prevent Supabase free-tier pause) |
| Analytics | None — no third-party analytics or user tracking, which is what the published Privacy policy states |

### Architecture rules

- **`engine/` owns all money math.** Pure TypeScript, zero app imports — the only place `Math.ceil` on money is allowed (`calc.ts` for match fees, `split.ts` for common-debit splits).
- **The write path is sacred:** browser → route handler (cookie check → zod validation → role check) → `withTransaction()` → response. The supabase-js client is never used for writes.
- **RLS keeps anonymous users out of base tables entirely** — public pages read only from purpose-built views (`players_public`, `pool_ledger_public`, `match_participants_public`, `player_statement`). The app stores no personal contact data: players are identified by a unique name.
- **Deletion is superadmin-only and always money-safe.** Deactivated players keep their full history; match edits reverse and reapply fees transactionally, and the auto-generated pool credit adjusts with them. When a superadmin deletes a match, one transaction removes its fee rows, the auto surplus credit, and — for booking matches — returns that slot's share to the ledger (the last slot removes the booking and its credit entirely); the captain settles the opponent's cash offline.

---

## Getting started

1. **Create a Supabase project**, then run in the SQL editor, in order:
   - `db/migration-1.sql` — schema, views, RLS (source of truth)
   - `db/migration-2.sql`, `db/migration-3.sql`, `db/migration-4.sql` (run migration-4 statement-by-statement — its enum additions can't share a transaction with the constraint that uses them), `db/migration-5.sql`, `db/migration-6.sql`, `db/migration-7.sql`, `db/migration-8.sql` (statement-by-statement, same reason as migration-4), `db/migration-9.sql`, `db/migration-10.sql`, `db/migration-11.sql`, `db/migration-12.sql`, `db/migration-13.sql`, `db/migration-14.sql`, `db/migration-15.sql`, `db/migration-16.sql` (restores the ₹900 balance-status threshold — required on fresh setups, no-op where it was already applied), `db/migration-17.sql`, `db/migration-18.sql`, `db/migration-19.sql` (tournaments — isolated per-tournament rosters and ledgers), `db/migration-20.sql` (tournament captain & vice-captain), `db/migration-21.sql` (tournament team name + venue), `db/migration-22.sql` (tournament matches — SG match engine scoped per tournament), `db/migration-23.sql` (tournament participation-fee model), `db/migration-24.sql` (tournament statement drill-down views), `db/migration-25.sql` (per-match tournament fee model — charge lines)
   - `db/seed-superadmin.sql` — seeds the platform megaadmin (template; never commit a real password)
   - `db/seed-team-superadmin.sql` — seeds a team's superadmin + membership (same rule)
   - `db/clear-dev-data.sql` + `node db/reset.mjs --confirm` — wipes every data table, keeps only the megaadmin (take a backup first)
   - optionally `db/seed-dev.sql` / `db/seed-matches-dev.sql` for dev data

2. **Configure environment** — copy `.env.example` to `.env.local`:

   | Var | Purpose |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public view reads |
   | `DATABASE_URL` | Supabase **transaction pooler** string (port 6543) — all writes |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only client, never shipped to the browser |
   | `SESSION_SECRET` | Signs the admin session JWT |
   | `CRON_SECRET` | Guards `/api/cron/keepalive` |

3. **Run it:**

   ```bash
   npm install
   npm run dev        # http://localhost:3000
   npm test           # money engine unit tests
   npm run lint
   ```

Deployment targets Vercel; `vercel.json` schedules the daily keepalive cron.

The database is backed up daily to encrypted GitHub Actions artifacts with a rolling 30-day retention window — setup and restore steps in [`db/BACKUP.md`](db/BACKUP.md).

---

## Project structure

```
app/          Pages + API route handlers (validate → auth → engine/db; no business math)
engine/       Money engine — calculateMatchFees(), ceilSplit(), unit tests
components/   UI only (shadcn/ui, dashboard, match wizard, pool sheets, admin forms)
lib/          Session (jose), pg pool + withTransaction(), formatting, zod validation
db/           SQL migrations (migration-1.sql is authoritative) + seeds
context/      Design docs: architecture, build plan, UI rules/tokens, progress tracker
support_docs/ v0 feature spec, kickoff, schema, screen references
```

## Out of scope for v0

Player logins, score/statistics beyond Won/Lost, payment processing, WhatsApp summaries, multi-team support, season filters (label only), no-show penalties.
