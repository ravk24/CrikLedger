# Memory — sessions 18–19: pricing curtain, captain phone + WhatsApp fee messages, tournament Schedule tab, Home onboarding, feedback card

Last updated: 2026-08-25 (session 19, end)

## What was built

All on `main`, pushed; working tree clean. Commits in order: `9c64b16`, `8c364c2`, `c8ee5af`, `adc9ddf`, `2fc120a`, `887ac76`. Migrations **43 and 44 are applied** to the shared Supabase project.

- **Pricing curtain on /tournaments** (`9c64b16`): visitors without a tournament credit see a collapsed disclosure ("Want to host your tournament here?") between the CTA and the read-only directory; expands to `<ProductCard product={TOURNAMENT} />` + the new `components/shared/HowPaymentWorks.tsx` (extracted verbatim from `/pricing`, which now renders it too). Disclosure idiom copied from `InstallCard` (aria-expanded + rotating ChevronDown + conditional render).
- **Captain phone + fee-collection message** (`8c364c2`): migration-43 adds `players.phone TEXT` with CHECK `^\+?[0-9]{8,15}$` — deliberately NOT in `players_public` or any view. `captainPhoneSchema` in `lib/validate.ts` (strips `[\s()\-.]`; null=clear, undefined=untouched). `POST /api/players/[id]/captain` takes an optional `{phone}` body (`phone = CASE WHEN $3 THEN $4 ELSE phone END`); re-POSTing the current captain = phone-only edit. `CaptainTile` has the tel input (prefilled via a pool query in `app/admin/page.tsx`; button says "Save phone number" on phone-only change; empty input = clear). On `app/matches/[id]/page.tsx` the phone rides `buildAdminProps` only (never the anonymous RSC payload); `ShareMatchSheetButton` gained `feeMessage?: ShareFeeMessage` — clipboard-copies the message BEFORE the PNG fetch (iOS user-activation), passes `text` to navigator.share best-effort with a TypeError image-only retry, inline "Fee message copied — paste it below the image." notice (no toast system in the app).
- **Fee message in demo + tournaments** (`c8ee5af`): builders live in `lib/feeMessage.ts` (`buildGuestFeeMessage`, `buildDuesMessage`, `ShareFeeMessage` type). Demo: `DEMO_CAPTAIN_PHONE = "9000000000"` in `lib/demo/fixtures.ts`; `GuestMatchSheet` copies on BOTH Share and Download when the sample has guests. Tournaments: migration-44 adds `tournament_players.phone` (same CHECK, view-absent); tournament captain route/`setCaptain(id, pid, phone?)`/`TournamentCaptainTile` mirror the team flow (threaded via `TournamentAdminPanel` `captainPhone` prop from a pool query on the admin tab page); `DownloadImageButton` gained generic `shareText?: string` (copy-first + text rider + retry + copied tooltip; error wins over copied); tournament Home tab builds a dues message (active players with `balance < 0`, biggest debtor first, captain excluded, phone fetched only when `isAdmin && owing.length > 0`).
- **Feedback card on More** (`adc9ddf`): full-width static section at the bottom of `app/(app)/more/page.tsx` (outside Suspense — stays prerendered): "Help us make CrikLedger better", WhatsApp button (`wa.me/<number>?text=` prefill) + mailto. New `lib/contact.ts` (`WHATSAPP_NUMBER`, `SUPPORT_EMAIL`, `SUPPORT_PHONE_DISPLAY`); purchases page imports it; ~15 older literal copies elsewhere left alone.
- **Tournament Schedule tab** (`2fc120a`): replaces the Matches tab, mirroring SG. New `app/tournaments/[id]/(tabs)/schedule/{page,upcoming/page,completed/page}.tsx` — hub with `TournamentScheduleMatch` action tile (clone of `ScheduleMatch`, opens the existing `TournamentScheduleMatchSheet`; gate = scope-aware `canWrite` AND `status === "active"`, dimmed-not-hidden) + Scheduled/Completed tiles; upcoming is month-grouped (local `groupByMonth` — did NOT reuse `ScheduledMatchList`, its filters read SG-only fields), completed flat with played-counts. `TournamentMatchCard` upgraded row→card (scheduled border tint, abandoned surface, ResultBadge via `matchState`). Tab bar + `TournamentTabBarGate` shell both swapped Matches→Schedule (CalendarDays). Old `(tabs)/matches/page.tsx` is now a Suspense-wrapped `return redirect(...)` (streams as 200 + redirect payload — `return` needed or tsc fails on Promise<void>). Detail page has a streamed status-aware `BackLink` (Upcoming/Completed; fallback `TournamentBackLink segment="schedule"`); delete push in `TournamentMatchAdminActions` is status-aware; AdminPanel's "Schedule Matches" tile/sheet/state removed.
- **Home onboarding + redirect** (`887ac76`): `components/dashboard/HowToUseCard.tsx` (presentational; returns null when all steps done — auto-retires, no dismiss), `LedgerHowTo.tsx` (superadmin-only; steps: name team [exact match vs `` `${admin.name}'s team` `` placeholder], add players, captain+phone, first match; one pool query), `TournamentHowTo.tsx` (self-contained — renders in BOTH `DashboardData` and `HomeIntro` since tournament-only buyers see the intro; gate includes `!isMegaadmin` because `hasEntitlement` is true for the operator; one 4-subselect pool query; deep-links to newest tournament, step 4 → `/tournaments/{id}/schedule`). `ChangePasswordForm` redirect: `requireCurrent ? "/admin" : "/"` — forced first-login lands on Home, voluntary change returns to console.

## Decisions made

- Captain phone: stored on the person (players / tournament_players), never per match; kept on captaincy transfer; NEVER exposed in any public view — read via pool inside admin-gated paths only (narrow documented reversal of migration-5's phone removal).
- WhatsApp drops share-sheet `text` riding with `files` → clipboard-copy-first is the primary channel everywhere; `canShare` probe stays files-only.
- Fee checklist lists guests only (team matches) / owing players (tournaments — dues model, since tournament matches carry no money: `fee_amount` always 0, settlement at tournament completion).
- Demo shows the fee message with a fake fixture number (no input in the demo).
- Tournament schedule: single-match creation only (opponent+time NOT NULL blocks multi-date); creation lives ONLY on the Schedule hub (Admin tile removed); tournament pages stay publicly link-readable (no AccessGate).
- Onboarding checklists compute done-ness live and auto-hide; no stored "onboarded" flag, no dismiss.

## Problems solved

- PowerShell here-string commit failed (parser split the multi-line message into pathspecs) — use the Bash tool with a quoted multi-line `-m` for commits.
- `redirect()` as last statement of an async component → TS2786 (Promise<void>); write `return redirect(...)`.
- Standalone tournament-credit buyers see `HomeIntro`, not the dashboard (`hasTeamLedger` false) — any "for buyers" Home surface must render in both branches.
- `nav.hasTeamLedger` is true for any member incl. viewers, and megaadmin passes `hasEntitlement` for everything — role-gate onboarding/config surfaces explicitly.
- No completed matches exist in the rebuilt prod DB yet, so end-to-end share flows were verified structurally + via curl (no phone in anonymous payloads), not with real data.

## Current state

Everything above deployed to main → Vercel. Typecheck/lint/81 vitest/build all green (pre-existing build noise: `[ops/accounts]` cookies-during-prerender error line, exit still 0 — not ours). Phones in DB are all NULL (test values reverted); the real captain phone gets entered by the superadmin via the captain tile.

## Next session starts with

Walk the real flows on a device: (1) ops grant → temp password → forced change → lands on Home → checklist ticks off and disappears; (2) set captain phone, complete a match with guests, share to WhatsApp and paste the copied message; (3) tournament: schedule from the new hub, balances share with dues message. Fix any copy/UX rough edges found.

## Open questions

- Should the ~15 remaining hardcoded contact literals (contact/how-to-buy/policies/HowPaymentWorks) migrate to `lib/contact.ts`? Deferred to keep diffs small.
- Old matches-list URL redirect streams as HTTP 200 + redirect payload (Suspense) — fine for browsers; revisit only if crawlers/SEO ever matter for that URL.
- `LedgerHowTo` step-1 heuristic: a user who deliberately names their team exactly "<their name>'s team" keeps the step unticked (harmless, but known).
