# Memory — session 20: 2-step onboarding checklists; tournament card moved to the tournament Home tab (on top of sessions 18–19: captain phone + fee messages, Schedule tab, pricing curtain, feedback card)

Last updated: 2026-08-25 (session 20, end)

## What was built

All on `main`, pushed; working tree clean. Latest commit `6e5431a`. Migrations **43 and 44 are applied** to the shared Supabase project.

### Session 20 (`6e5431a`)
- `components/dashboard/LedgerHowTo.tsx` — now exactly two reminders: (1) "Add your players" → `/admin/players`, done = `players.length > 0`; (2) "Add your captain and phone number" → `/admin`, done = captain exists AND `players.phone` not null. Team-name and first-match steps removed; prop is now `teamId: string` (not `team`). One pool query (captain phone), superadmin-only gate unchanged.
- `components/tournaments/TournamentHowTo.tsx` (moved from `components/dashboard/`) — props-driven `{ tournamentId, hasPlayers, hasCaptainPhone }`, no session/DB access; same two steps, both linking to `/tournaments/{id}/admin`.
- `app/tournaments/[id]/(tabs)/page.tsx` renders it (after the heading/completed banner, before `PoolSummaryCard`) gated by `isAdmin && tournament.status === "active"`. The tab's captain-phone `pool.query` now runs whenever `isAdmin && captainRow` (was also `owing.length > 0`) and feeds both the dues `shareText` (still requires owing) and the checklist tick.
- `<TournamentHowTo />` removed from `app/(app)/page.tsx` (DashboardData) and `components/install/HomeIntro.tsx` — the app Home shows only the ledger checklist; `HomeIntro` has no async children again.

### Sessions 18–19 (still relevant, unverified on device)
- Pricing curtain on `/tournaments` (`ProductCard` + `components/shared/HowPaymentWorks.tsx`).
- Captain phone: `players.phone` (migration 43) and `tournament_players.phone` (migration 44), CHECK `^\+?[0-9]{8,15}$`, absent from every public view; read only via pool inside admin-gated paths. Set via `CaptainTile` / `TournamentCaptainTile` (re-POST of current captain = phone-only edit).
- Fee messages: `lib/feeMessage.ts` (`buildGuestFeeMessage`, `buildDuesMessage`); `ShareMatchSheetButton` and `DownloadImageButton` copy the text to the clipboard BEFORE the image fetch, then best-effort share with `text`. Demo uses `DEMO_CAPTAIN_PHONE` fixture.
- Tournament Schedule tab (`app/tournaments/[id]/(tabs)/schedule/…`) replaces Matches (old URL redirects); creation only from the Schedule hub.
- Feedback card on More, `lib/contact.ts` for WhatsApp/email constants.
- `ChangePasswordForm` redirect: forced first-login → `/`, voluntary → `/admin`.

## Decisions made

- Onboarding checklists: exactly two reminders each, players first (the captain is chosen from existing players, so the order ticks top-to-bottom). Live-computed, auto-hide when both done, no stored flag, no dismiss.
- The tournament checklist lives ONLY on each tournament's Home tab (`/tournaments/{id}`), per tournament, for admins of an active tournament. Never on the app Home — not even for tournament-only buyers who see `HomeIntro`.
- Captain phone stays on the person (players / tournament_players), never per match, never in a public view.
- Clipboard-copy-first is the primary channel for fee messages (WhatsApp drops share-sheet `text` when `files` are present).
- Team fee list = guests; tournament list = owing players (dues model).

## Problems solved

- Commits on Windows: PowerShell here-strings break multi-line messages — use the Bash tool.
- `redirect()` as the last statement of an async component → TS2786; write `return redirect(...)`.
- `nav.hasTeamLedger` is true for any member incl. viewers, and megaadmin passes `hasEntitlement` for everything — role-gate onboarding/config surfaces explicitly (LedgerHowTo: `activeTeamRole === "superadmin"`; tournament card: scope-aware `isAdmin`).
- Onboarding cards need no Home-branch duplication any more (the tournament one moved off Home entirely).

## Current state

Deployed to main → Vercel. `tsc`, `eslint`, 81 vitest tests, `next build` all green (pre-existing build noise: `[ops/accounts]` cookies-during-prerender line, exit still 0 — not ours). Prod phones are all NULL until the superadmin enters the real captain phone. No completed matches in the rebuilt prod DB yet, so share flows were verified structurally + via curl only.

## Next session starts with

On-device walk of the real flows: (1) ops grant → temp password → forced change → lands on Home → 2-row "How to use your Team Ledger" card ticks and disappears, and NO tournament card on Home; (2) open an active tournament's Home tab → 2-row "How to use your Tournament" card, add players / set captain + phone on the Admin tab → ticks, card disappears; a completed tournament shows no card; (3) set captain phone, complete a match with guests, share to WhatsApp and paste the copied message; (4) schedule a tournament match from the Schedule hub and share balances with the dues message. Fix copy/UX rough edges found.

## Open questions

- Migrate the ~15 remaining hardcoded contact literals (contact / how-to-buy / policies / HowPaymentWorks) to `lib/contact.ts`? Deferred to keep diffs small.
- Old tournament matches-list URL redirect streams as HTTP 200 + redirect payload (Suspense) — fine for browsers; revisit only if crawlers/SEO matter.
