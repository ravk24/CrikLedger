# Memory — guest labels · splash · car fee · the production sign-in outage

Last updated: 2026-08-21 13:05 (session 10, end)

`main` @ `f4e3dc9`, pushed to `ravk24/CrikLedger`, tree clean. Five commits on top of
`584d305`:

| commit | |
|---|---|
| `d33fc7e` | sheet: a guest's name is just a name |
| `52b7ba9` | splash: the app opens straight into the app |
| `8bf501c` | car-fee: a calculator anyone can open |
| `a99a915` | pricing: a tournament is run by one team, not several |
| `f4e3dc9` | ops: say which variable is wrong, instead of "Server error" |

Session 9 ended mid-flight — VS Code was closed with three changes uncommitted. They were
finished, verified in a browser and committed here, and then a fourth problem surfaced:
**sign-in was broken on Vercel** and had been since the deploy.

## What was built

- **Guest labels off the match summary.** The word "guest" no longer decorates a guest's
  name anywhere on the sheet: `components/matches/FeeTable.tsx` (the `GUEST` chip),
  `components/guest/GuestMatchSheet.tsx`, the car chips on `app/matches/[id]/page.tsx`,
  `app/api/share/match-sheet/route.tsx` (the renderer *and* the `guest` field on its zod
  row schema), and `components/wizard/StepFeePreview.tsx` — the last one found only by
  walking the flow, since its badge sits on its own line and text-grep missed it.
- **Splash gone.** `components/shared/SplashScreen.tsx` deleted and unwired from
  `app/layout.tsx`; `/splash.png` dropped from `public/sw.js`'s precache with
  `STATIC_CACHE` bumped `v3` → `v4`. `public/splash.png` and its branch in
  `scripts/generate-icons.mjs` kept.
- **Car Fee Calculator works signed out.** `app/(app)/car-fee/page.tsx` moved from
  `getCurrentTeam()` to `getActiveTeam()`, with `9.6` (the migration-26 schema default) and
  a finite-and-positive guard on the rate.
- **Ops diagnosability** (`f4e3dc9`): new `app/api/health/route.ts`; `lib/db.ts` no longer
  hands `undefined` to node-postgres; `lib/session.ts` no longer asserts `SESSION_SECRET`
  with `!`; `app/api/cron/keepalive/route.ts`'s bare `catch {}` now logs.
- `lib/products.ts`: "Add teams" → "Add your team".

## Decisions made

- **The word "guest" goes where it labels a person, stays where it explains money.**
  Removed from names on the summary; kept for the "12 attendees · 1 guest" count, the
  `GUEST FEES` chip on a non-playing captain's row (the only thing explaining why he has a
  row), "incl. ₹214 guest fees", and the cash-transfer footer. Also kept in
  `StepSharedCar.tsx` — that is data entry, where telling a guest from a squad player helps
  the admin. `StepFeePreview` was the borderline call and went the other way: it is a
  summary, one screen before the sheet.
- **The splash was deleted, not set to 0ms.** A zero-hold component still mounts, writes
  sessionStorage and priority-fetches a 512px PNG on every load.
- **`/api/health` reports presence booleans only** — never a value, never a length — behind
  the same `CRON_SECRET` bearer check the cron uses. It imports `lib/db` and `lib/session`
  *inside* the check, because they throw on a missing variable by design and a static
  import would take the diagnostic down with them.
- **`lib/db.ts`'s guard is lazy, via a Proxy.** Module-scope throwing broke
  `lib/nav.test.ts`: `lib/nav.ts` reaches `lib/db` transitively through `lib/session.ts`,
  and the unit suite deliberately runs with no database (`vitest.config.mts` says so). The
  Proxy keeps all ~43 `pool.query` call sites and their generics untouched.
- Client-facing copy stays generic — which variable is missing is an operator's business.

## Problems solved

- **Production sign-in returned "Server error" for every account.** Cause: Vercel's
  `DATABASE_URL` was the **direct** host `db.uodvxcikqjxuukiqkpwz.supabase.co:5432`, which
  a Vercel function cannot even resolve — `getaddrinfo ENOTFOUND`. Fixed by switching it
  (Vercel *and* `.env.local`) to the transaction pooler
  `aws-0-ap-southeast-1.pooler.supabase.com:6543`, user `postgres.<ref>`. `.env.example`
  had warned about exactly this all along.
  - It was never a credentials problem: `LoginForm` shows that string for any code that is
    not `INVALID_CREDENTIALS`/`ADMIN_REVOKED` — i.e. `handleRouteError`'s `INTERNAL`.
  - It was never only login: all ~43 modules importing `lib/db` were dead. The site looked
    healthy because every public page is prerendered and reads Supabase over HTTPS.
  - Diagnosis path worth reusing: `/api/cron/keepalive` is already a side-effect-free
    `SELECT 1` probe; `vercel env ls production` for names; `vercel logs <url> --json` for
    the real exception. `vercel env pull` is useless for this — variables marked Sensitive
    come back as `[SENSITIVE]`.
- **The database password was rotated** during the fix. Anything else holding a connection
  string to project `uodvxcikqjxuukiqkpwz` — including the other repo that once wiped it —
  is now stale until updated.
- An **orphaned `next dev` from the crashed session** was still serving port 3000. Next 16
  also refuses to start a second dev server in the same directory, so testing a bad
  `DATABASE_URL` meant stopping the first one.
- `npx prettier` pulled in a version this project does not depend on and reformatted an
  unrelated block in `lib/session.ts`; reverted by hand.
- In the browser tool, coordinate clicks did not land on this app — `find`/`ref` clicks and
  in-page JS did.

## Current state

- `npm run lint` clean · `npx tsc --noEmit` clean · **79 tests pass (6 files)**.
- **Production is healthy and sign-in works** (confirmed by the user). `/api/health` on
  `crik-ledger.vercel.app` returns `ok:true`, `db:"ok"`, `sign:"ok"`, all six variables
  present, region `iad1`; `/api/auth/login` with a bogus user now returns
  `INVALID_CREDENTIALS` (was `INTERNAL`); keepalive returns `{"alive":true}`.
- Verified in the browser: the 8-step sample with two guests, the sheet and its PNG with no
  guest labels, step 8 likewise, a real completed match at `/matches/[id]` (Andheri
  Warriors, one guest) with no `GUEST` badge, the car calculator at ₹192 for 10 km, and
  `crikledger-static-v4` holding exactly three assets with no splash.
- The **Vercel CLI is now installed and this repo is linked** to project `crik-ledger`
  (scope `ravi-kants-projects-3dfe462a`). `vercel link` added `.vercel` and `.env*` to
  `.gitignore` and dropped a short-lived `VERCEL_OIDC_TOKEN` into `.env.local`;
  `.env.local` has never been committed.
- **Still not verified: the paid match wizard end to end.** The signed-in account here has
  no Team Ledger, so completing a real match as an admin remains untested; only the public
  match page and the anonymous sample were exercised.

## Next session starts with

1. Complete one real match as a team admin — confirm stored fees match the preview (the
   server computes them since session 9) and the pool credit is right. This is the last
   unverified path of the car-sharing work.
2. Then resume the deferred **Feature 3 — products & entitlements**: DDL is **migration
   35** (34 is taken), then swap the body of `hasEntitlement()` in `lib/entitlements.ts`.
   `lib/products.ts` should feed that table.

## Open questions

- **Share text alongside the image** (carried from session 9, still unanswered):
  `navigator.share` accepts `text`/`url` with `files`, but WhatsApp commonly drops the
  caption when an image is attached; `canShare` must be re-checked with the full payload;
  the Download path has nowhere to put a link. Options were (a) caption + keep the URL on
  the image, (b) caption only, (c) caption + copy-to-clipboard.
- **The paid flow still has no image share.** `GuestMatchSheet.tsx` is the only
  share/download in the codebase; admins paste the page URL by hand. A share button on
  `app/matches/[id]/page.tsx` (server component — needs a client child) or in the
  MatchWizard success pane is unbuilt.
- Carried forward, still open: account deletion unimplemented while the privacy policy
  promises an email path; compliance copy is not legal advice; revisit the public home
  address now that Razorpay's requirement no longer applies; secure the `crikledger`
  domain; the other repo still shares this Supabase project and `db/BACKUP.md`'s secrets
  are still unarmed.
- Prices still live in `lib/products.ts` **and** Terms §2 and the `/purchases` blurbs — one
  more reason for the products table to become the source of truth.
- `lib/utils.ts:9-11` still carries a `hasEnvVars` tutorial leftover reading
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, a variable that exists nowhere in this project.
