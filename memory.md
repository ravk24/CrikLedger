# Memory — Car sharing in the fee engine · anonymous-visitor rework · repo rename

Last updated: 2026-08-20 23:25 (session 9, end)

Remote is **`ravk24/CrikLedger`** (renamed from `crikledger-old-repo` this session; the old
URL now redirects). `main` @ `a43179f`, pushed, tree clean. Thirteen commits:

| commit | |
|---|---|
| `045948c` | memory: remote renamed to ravk24/CrikLedger |
| `e7b1b9c` | guest: sample match walks all seven paid windows |
| `d86e34c` | home: give the installed app somewhere to go next |
| `9982c69` | legal: reach the policies through More, not every page |
| `681319e` | nav: visitors land on Schedule, Home moves to second — **reverted by `ca76831`** |
| `3cf626a` | home: three cards — install, Ledger, Tournament |
| `d562ebc` | legal: Ledger refundable in 30 days, Tournament not |
| `1f160cb` | guest: fixed sample costs, Barne, no cars step when the fee is ignored |
| `ca76831` | nav: Home is the first tab again, for everyone |
| `1c680ee` | engine: only the people who rode fund the cars |
| `5ea81e4` | wizard: eight steps, with who brought and who shared the car |
| `6ab7a67` | share: put the site address on the match image, add WhatsApp |
| `a43179f` | copy: drop the tagline from the copyright bar |

## What was built

- **Car sharing in the money engine** (`engine/calc.ts`, `db/migration-34.sql`,
  `components/wizard/StepSharedCar.tsx`). Match completion is now 8 steps in both the paid
  wizard and the anonymous sample: result → costs → players → guests → car fee → who brought
  the car → who shared the car → fee preview. Ignoring the car fee drops both car windows
  (8 → 6). New step lists players *and* guests with an Include all control; drivers show as
  DROVE and are not tickable.
- **Fees are read-only and server-computed.** All tap-to-edit machinery deleted from both
  flows (input, edited dot, Reset edits, "Discard fee edits?" dialog, `WizardInitial.fees`).
  `matchSubmitSchema.rows` carries attendance only; `completeMatch` stores its own
  `calculateMatchFees` output.
- **Anonymous Home is three cards** — How to install → `/install`, then the Ledger ₹99 and
  Tournament ₹29 cards, both tapping through to `/how-to-buy` (retitled "How payments work",
  URL unchanged). Catalogue extracted to `lib/products.ts` + `components/shared/ProductCard.tsx`,
  shared with `/pricing`; `components/install/NextSteps.tsx` was built then deleted when the
  three cards replaced it.
- **Sample match reworked**: Supergiants vs Challengers at **Barne**, fixed non-editable costs
  (ground 2500 / ball 60 / allowance 250), guests, abandon path, car icon instead of the word
  "car", and the shared PNG carries guest rows plus **crik-ledger.vercel.app** (`lib/site.ts`).
- **Legal**: the Terms/Privacy/Refunds footer strip is deleted from every page
  (`components/legal/LegalFooter.tsx` gone); the policies are reached only through
  More → About us. Per-product refund terms written across pricing, how-to-buy, refund policy,
  terms, about, about-us, purchases. WhatsApp (`wa.me/919142349007`) added beside the phone
  number on the three support surfaces.
- **Ledger tab**: the "Your team's ledger, kept for you" upsell card removed; demo rows
  realigned to the sample match.
- `lib/nav.test.ts` added — the first test asserting tab order.

## Decisions made

- **Only passengers fund the cars.** `sharers = shared_car AND NOT brought_car`;
  `baseShare = ceil(base / heads)`, `carShare = ceil(cars × allowance / sharers)`. Drivers pay
  no car share and take the rebate. **If nobody shared, no car money is collected and no
  rebate is paid.**
- That rule is an explicit `carSplit: "everyone" | "sharers"` option, **not** inferred from
  whether anyone ticked a box. The tournament preview calls the same engine and never collects
  sharing — inferring it would have silently deleted every tournament driver's rebate. Default
  is `"everyone"`, which is why all 21 pre-existing engine tests pass untouched.
- `surplusToPool` redefined as `collected − cash costs`: identical to the old formula under
  `"everyone"`, and it now matches what `completeMatch` actually credits to the pool.
- Guests can be sharers (`matches.guest_shared_cars`, index-aligned with `guest_names`).
  **Tournaments unchanged** — `engine/tournamentFee.ts` untouched, tournament wizard passes
  `hasSharing={false}` and stays at 4 steps.
- **Tab order is state-independent.** Schedule-first-for-visitors was built and then reverted
  on request; the cost it carried (tab bar reading cookies, prerendered shell guessing an
  order) went away with it.
- Legal links two taps deep is a deliberate trade — they were added for Razorpay compliance
  (`6203670`), so this is the change to point at if a reviewer asks for a footer link.

## Problems solved

- Repo rename: origin moved to `ravk24/CrikLedger` after verifying by `git ls-remote` that the
  renamed repo carries this project's history. The old "CrikLedger is an unrelated repo"
  hazard note is obsolete; the *other* project (tenancy/Supabase migration) is what shares the
  Supabase project and once wiped it.
- Satori renders inline SVG, so the shared PNG shows a real car icon rather than the word
  "car" — verified by generating the image, not assumed.
- The guest sample's Next button was labelled per-screen and said "Next — cars" after the cars
  step was dropped; labels are now derived from the step list.
- Include all had to be a bulk callback: MatchWizard's per-id toggle rebuilds its Set from a
  render-time closure, so looping it would keep only the last change.

## Current state

- `npm run lint` clean · `npx tsc --noEmit` clean · `npm run build` clean · **79 tests pass
  (6 files)**, up from 66.
- **Migration 34 is applied** (`match_participants.shared_car`, `matches.guest_shared_cars`,
  both public views) — verified against the live DB on 2026-08-20 17:27 UTC. There is only
  ONE database: `.env.local`'s `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are the same
  Supabase project (`uodvxcikqjxuukiqkpwz`), so "dev" and "prod" are the same rows. Still
  unconfirmed from here: whether **Vercel's** env vars point at that same project — check the
  Vercel dashboard (or `vercel env pull`, CLI not installed) before assuming production is
  covered.
- Verified in the browser signed out: 8-step sample, base ₹233 + ₹125 car share for 6 riders,
  drivers −₹17, surplus ₹3; Include all picking up an added guest (8 → 9 sharers, ₹94 → ₹84);
  ignore-car-fee collapsing to 6 steps; fees not tappable; PNG carrying the site address.
- **Not verified: the paid admin flow end to end** — no credentials for a signed-in account
  this session. Types, tests and shared step components cover it; a real completed match does
  not.

## Next session starts with

1. **Apply migration 34 to production** before or with the next deploy, and complete one real
   match as a team admin to confirm stored fees match the preview (the server computes them
   now) and the pool credit is right.
2. Then answer the open share question below, or resume the deferred **Feature 3 — products &
   entitlements**: DDL is now **migration 35** (34 is taken), then swap the body of
   `hasEntitlement()` in `lib/entitlements.ts`. `lib/products.ts` is the new single source for
   names/prices/refund terms and should feed that table.

## Open questions

- **Unanswered from this session:** sending the site link as share *text* alongside the image.
  Findings: `navigator.share` accepts `text`/`url` with `files`, but WhatsApp commonly drops
  the caption when an image is attached; `canShare` must be re-checked with the full payload;
  and the Download path has nowhere to put a link. Options offered were (a) caption + keep the
  URL on the image, (b) caption only, (c) caption + copy-to-clipboard. No choice made.
- **The paid flow has no image share at all** — `components/guest/GuestMatchSheet.tsx` is the
  only share/download in the codebase. Admins share a completed match by pasting the page URL
  by hand. A share button on `app/matches/[id]/page.tsx` (server component — needs a client
  child) or in the MatchWizard success pane is unbuilt work.
- Carried forward, still open: account deletion unimplemented while the privacy policy
  promises an email path; compliance copy is not legal advice; revisit the public home address
  now that Razorpay's requirement no longer applies; secure the `crikledger` domain; the
  other repo still shares this Supabase project and the backup workflow is still unarmed.
- Prices now live in `lib/products.ts` **and** Terms §2 and `/purchases` blurbs — one more
  reason for the products table to become the source of truth.
