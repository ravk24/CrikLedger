# Database backups

The Supabase database is the single source of truth for the club ledger, so it is backed up automatically every 5th day by the GitHub Actions workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml).

- **Schedule:** every 5th day of the month (1st, 6th, 11th, 16th, 21st, 26th, 31st) at 21:30 UTC (3:00 AM IST) — cron `30 21 */5 * *`. The 31st → 1st gap is one day; that's fine.
- Runs from 18–21 Aug 2026 were the original *daily* schedule, renamed and slowed to 5-day on 2026-08-21.
- **What is backed up:** a full `pg_dump` of the `public` schema — all tables, views, functions, and RLS policies, plus every row of data.
- **Where it goes:** an encrypted workflow artifact on the run (GitHub → Actions → DB Backup (every 5 days) → pick a run → Artifacts).
- **Retention:** the **newest 7 backups** are kept, by count. The last step of every successful run lists the `db-backup-*` artifacts and deletes everything after the 7th — so the 8th backup evicts the 1st, the 9th evicts the 2nd, and so on (about 35 days of history at one run per 5 days). Manual runs count like scheduled ones. A failed run never prunes, so seven good backups stay seven. GitHub's own `retention-days` is set to 90 purely as a backstop. (Until 2026-09-09 this was a plain 30-day window.)
- **Encryption:** every dump is gzip'd and GPG-encrypted (AES256) with a passphrase before upload. Without the passphrase the artifact is unreadable. The repo is private (it was public when this was written), but the encryption stays: anyone with repo access can download an artifact, and the passphrase is the second factor.
- **Alerting:** GitHub emails the repo owner automatically if a scheduled run fails.

## Status

- **2026-09-09:** `BACKUP_PASSPHRASE` rotated (the old one was lost; artifacts run7–run13 are encrypted with it and will be pruned or expire). Manual run #14 green with the new passphrase — artifact `db-backup-2026-09-09-run14`. Retention switched from a 30-day window to the newest-7 count above; the first prune removes run7.
- **2026-08-22 (armed):** first successful run #7 — artifact `db-backup-2026-08-22-run7` (19 KB, expires 2026-09-21). Runs 1–6 failed because the `Production` environment had no secrets, then a direct-connection URL, then a pooler URL with user `postgres` instead of `postgres.<ref>`. If it ever breaks again, fall back to a local dump before each migration with the installed client: `"C:/Program Files/PostgreSQL/17/bin/pg_dump.exe" "<session-pooler-url>" --schema=public --no-owner --no-privileges --clean --if-exists -f backup.sql` (the session pooler URL is the app's `DATABASE_URL` with port `6543` replaced by `5432`). Last local dump: 2026-08-22, before migration 40.

## One-time setup (required before the first backup works)

Add two secrets at **GitHub → repo → Settings → Environments → Production → Add environment secret** (the workflow job declares `environment: Production`, so it reads *environment* secrets; repository-level secrets under Secrets and variables → Actions would also work). From a terminal: `gh secret set SUPABASE_DB_URL --env Production` and `gh secret set BACKUP_PASSPHRASE --env Production` (each prompts for the value).

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | The **Session pooler** connection string from Supabase Dashboard → **Connect** → *Session pooler*. It is the app's `DATABASE_URL` with port **5432** instead of 6543: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. ⚠️ Not the unmodified `DATABASE_URL` — `pg_dump` cannot use the transaction pooler (port 6543), and the workflow fails fast if it detects one. |
| `BACKUP_PASSPHRASE` | A strong passphrase of your choosing. **Save it in a password manager too** — if it is lost, every backup is permanently unreadable. GitHub never shows a secret again; if it is lost, overwrite it with `gh secret set BACKUP_PASSPHRASE --env Production`, run the workflow once by hand, and decrypt that artifact to prove the new value works (done 2026-09-09). |

Then trigger a manual run to verify: **Actions → DB Backup (every 5 days) → Run workflow** (or `gh workflow run "DB Backup (every 5 days)"`).

## Restoring a backup

1. Download the artifact from the desired run (Actions → DB Backup (every 5 days) → run → Artifacts) and unzip it to get `backup.sql.gz.gpg`.
2. Decrypt and decompress:
   ```sh
   gpg --decrypt --batch --passphrase "<BACKUP_PASSPHRASE>" backup.sql.gz.gpg > backup.sql.gz
   gunzip backup.sql.gz
   ```
3. Restore with `psql` (the dump includes `DROP ... IF EXISTS` statements, so it cleanly replaces existing objects in the target):
   ```sh
   psql "<session-pooler-url-of-target-project>" -f backup.sql
   ```
   To rehearse a restore safely, point this at a scratch Supabase project — never rehearse against production.

Notes:
- The dump is the *final* schema plus data, so the statement-by-statement caveat for `migration-4.sql` / `migration-8.sql` does not apply to restores.
- On Windows, `gpg` and `psql` are available via [Gpg4win](https://gpg4win.org) and the [PostgreSQL installer](https://www.postgresql.org/download/windows/) (only the command-line tools are needed).

## Manual on-demand backup

Actions → **DB Backup (every 5 days)** → **Run workflow** (e.g. right before running a risky migration).
