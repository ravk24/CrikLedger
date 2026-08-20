# Memory — DB wipe + rebuild · PWA install Home replaces Teams · V1 copy/analytics sweep committed

Last updated: 2026-08-20 (session 8, end)

Remote is **`ravk24/crikledger-old-repo`** (this repo; the *newer* CrikLedger repo is a
separate, unrelated project). `main` @ `e67af4a`, pushed, tree clean. Five commits this
session:

| commit | |
|---|---|
| `f2a492a` | v1: manual-payments copy + remove PostHog analytics (was uncommitted session-7 work) |
| `27c2019` | home: replace Teams directory with a PWA install guide |
| `081c515` | db: rebuild after Supabase wipe — tenancy-aware match seed + incident notes |
| `94b13b4` | lint: escape apostrophe in OtherScheduleWizard |
| `e67af4a` | lint: next/image in InstallNudge — **lint is now fully clean (0 errors, 0 warnings)** |

## What was built

- **PWA install Home** (`27c2019`): slot 0 of the tab bar is now always "Home"/home icon
  for everyone — the Teams/Home label swap is gone and `components/teams/TeamsDirectory.tsx`
  is **deleted** (no replacement list anywhere; the signed-out signup CTA was first carried
  over, then removed on request — `/signup` is now reachable only via the login page link).
  New: `components/install/{InstallGuide,PhoneDiagram,HomeIntro}.tsx` + `steps.ts`, public
  static route `app/(app)/install/page.tsx`, an "Install app" tile atop More, and
  InstallNudge's fallback now links "Show me" → `/install`. `buildTabs()` takes no NavState
  any more, so `AppTabBarGate` stopped reading cookies. Registry entry appended to
  `context/ui-registry.md`.
- **`db/seed-matches-dev.sql` rewritten** for the post-tenancy schema (old version predated
  migration 26 and no longer ran): rows scoped to `our-xi`, guest via `guest_names` +
  captain `guest_fee_share`, ground `'home'`, Ramesh K. captain / Priya S. vice-captain.

## Decisions made

- Teams directory is gone for good (user call); Home for non-Ledger users = welcome +
  install guide, nothing else.
- Install diagrams are **hand-drawn inline SVG** (first in the codebase) — no image
  assets, theme-aware, drawable offline under the network-first SW.
- SVG theme rule (recorded in ui-registry): never accent ink on `accent-light` fill —
  `accent-light` is pale in light mode but *saturated* in dark. Highlights = accent ring/
  border, row tints = `fill-accent` at 12% opacity, button labels = `accent-foreground`.
- DB incident response (user call): old rows written off as dev data — rebuild from
  migrations + reseed; foreign fixtures dropped (snapshotted first to session scratchpad).

## Problems solved

- **Root cause of the "deleted data": the newer CrikLedger repo's migration/test run was
  executed against THIS repo's Supabase project** (~07:32 UTC), dropping the whole `public`
  schema and leaving its own fixtures (`0001_init.sql`…`0013`, 37 `c_xxxxxxxx` accounts,
  `app.rate_limits`). Old rows unrecoverable: the backup workflow's `SUPABASE_DB_URL` /
  `BACKUP_PASSPHRASE` secrets were never set — both scheduled runs failed before dumping.
- Rebuild: dropped foreign objects, replayed migrations 1–33 via
  `node db/apply-migrations.mjs` (clean), reseeded accounts + dev data, verified all three
  role tiers by real login (superadmin dashboard, megaadmin → `/ops`, admin via API).
- Red herring during verification: dashboard "TEAM POOL ₹176" vs view's 2908 was just the
  `AnimatedRupees` count-up caught mid-animation — both connections point at the same
  project (`uodvxcikqjxuukiqkpwz`).

## Current state

- **Dev DB: 33 migrations applied (fresh replay).** Baseline: 11 players, 1 completed
  `home` match (fee 214, drivers −36, surplus 8) + 1 abandoned, 7 pool entries, 61 slots,
  pool **2908**.
- Three accounts: `ravi_kant` (megaadmin, no memberships), `ravi_kant_SA` (superadmin +
  owner of `our-xi`), `ravi_kant_AD` (team admin, slot 1). Passwords set directly in the
  DB — never in the repo; **all three transited chat this session and MUST be rotated
  before launch** (rotation SQL is commented in `db/seed-superadmin.sql`).
- `npm test` 66/66 · `npx tsc --noEmit` clean · `npm run build` clean · **`npm run lint`
  clean for the first time** (0 errors, 0 warnings).
- Verified in browser: install guide in both themes/platform toggles, `/install` public,
  More tile, dashboard + `/ops` post-rebuild.
- **The wipe can recur**: the newer repo still holds this project's connection strings,
  and the backup workflow is still unarmed. Both fixes are user-side (see next).

## Next session starts with

1. **Ask Ravi whether the two user-side fixes are done** before touching the DB: (a) the
   newer CrikLedger repo moved to its own Supabase project, (b) backup secrets set per
   `db/BACKUP.md` + one green manual run. Until then, snapshot before anything destructive.
2. Then resume the session-7 plan: **Feature 3 — products & entitlements**:
   `products`/`payments`/`entitlements` DDL as **migration 34**, then swap the body of
   `hasEntitlement()` in `lib/entitlements.ts` (built as the single seam). Prices live in
   three places (`/pricing`, `/purchases`, Terms §2) — the products table should become the
   source of truth. Decide the fate of `teams.is_sandbox` (migration 26, unused).
   Alternatively **Feature 7 hardening** (rate limiting, CSRF, bcrypt cost ≥10, RLS) —
   signup is public, which raises its urgency.

## Open questions

- Account deletion is **not implemented**; the privacy policy promises an email-request
  path (`crikledger@gmail.com`), so that inbox must be actioned.
- Compliance content is written but is **not legal advice** — review before launch.
- **Revisit the public address**: Ravi's home address/phone are public only because
  Razorpay required it — that justification no longer holds in V1.
- Secure the `crikledger` domain.
- Can a superadmin's 2 admins manage that team's tournaments? Teams opt-out of a public
  presence? `/[team]/` URL routing (deferred out of Feature 4). GST on pricing.
- `/signup` is now two taps deep (Home → Login → Sign up) — fine for V1's manual flow,
  but reconsider a Home entry point if signup conversion ever matters.
