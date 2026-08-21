# Database backups

The Supabase database is the single source of truth for the club ledger, so it is backed up automatically every 5th day by the GitHub Actions workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml).

- **Schedule:** daily at 21:30 UTC (3:00 AM IST).
- **What is backed up:** a full `pg_dump` of the `public` schema — all tables, views, functions, and RLS policies, plus every row of data.
- **Where it goes:** an encrypted workflow artifact on the run (GitHub → Actions → Daily DB Backup → pick a run → Artifacts).
- **Retention:** each artifact is kept for **30 days**, then GitHub deletes it automatically — a rolling 30-day window with zero cleanup code.
- **Encryption:** the repo is public, so every dump is gzip'd and GPG-encrypted (AES256) with a passphrase before upload. Without the passphrase the artifact is unreadable.
- **Alerting:** GitHub emails the repo owner automatically if a scheduled run fails.

## One-time setup (required before the first backup works)

Add two secrets at **GitHub → repo → Settings → Secrets and variables → Actions**. They live as **environment secrets** in the `Production` environment (the workflow job declares `environment: Production`); repository-level secrets with the same names would also work.

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | The **Session pooler** connection string from Supabase Dashboard → **Connect** → *Session pooler*. It uses port **5432** and looks like `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. ⚠️ Not the app's `DATABASE_URL` — `pg_dump` cannot use the transaction pooler (port 6543), and the workflow fails fast if it detects one. |
| `BACKUP_PASSPHRASE` | A strong passphrase of your choosing. **Save it in a password manager too** — if it is lost, every backup is permanently unreadable. |

Then trigger a manual run to verify: **Actions → Daily DB Backup → Run workflow**.

## Restoring a backup

1. Download the artifact from the desired run (Actions → Daily DB Backup → run → Artifacts) and unzip it to get `backup.sql.gz.gpg`.
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

Actions → **Daily DB Backup** → **Run workflow** (e.g. right before running a risky migration).
