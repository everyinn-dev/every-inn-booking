---
name: everyinn-d1-migration
description: Write, verify and apply a Cloudflare D1 migration for any Every Inn Worker (booking-db, cdp-db, agent-db, admin-db) safely — sequential numbering, expand/contract only, index-covered queries proven with EXPLAIN QUERY PLAN, local → dev → prod apply with owner approval for prod. Use whenever a task adds/changes a table, column, index, seed/master data (rates, bank info, rooms), or someone says "migration", "schema", "add column", "seed", "backfill", "update the prod DB", even when it looks like a one-line UPDATE.
---

# Every Inn — D1 migrations

D1 is SQLite, billed and rate-limited by **rows scanned and written**. Production started empty and must stay safe. A migration is applied to the dev DB first, then to production when the release is promoted. Prod changes need **explicit owner approval** (status-file rule R6). Several Workers share one Cloudflare account, so a wrong binding or `--env` can hit the wrong database. The scripts below guard against that, so always use them instead of raw `wrangler` commands.

## 1. Write it
- **File name:** `migrations/000N_snake_description.sql`, the next contiguous number. `node scripts/check-migrations.mjs` fails on gaps. Never edit a file that has already been applied anywhere; fix forward with a new number.
- **Expand/contract only:**
  - `CREATE TABLE IF NOT EXISTS`;
  - `ALTER TABLE … ADD COLUMN` (nullable or with a default);
  - `CREATE INDEX IF NOT EXISTS`;
  - idempotent `UPDATE`/`INSERT … ON CONFLICT DO NOTHING` for master data.
  - No `DROP`, rename or type change in a release window.
  - SQLite cannot change a `CHECK` constraint in place. Widening an enum (for example `source IN ('admin','legacy_import')`) means a table rebuild. Avoid it, or plan it as its own owner-approved release.
- **Indexes:** every new `WHERE`/`JOIN`/`ORDER BY` pattern needs one, with the equality columns first, then range, then sort (e.g. `(status, send_at)`). Partial indexes (`WHERE status = 'pending'`) keep hot queues small.
- **Timestamps** are ISO-8601 UTC TEXT (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`). Epoch seconds are used only where existing code expects them (`expires_at_sec`). Money is INTEGER VND.
- **Secrets and PII:** door codes go in a `*_enc` column (AES-GCM ciphertext). Never seed real guest data.

## 2. Prove the queries
Run each new query against a local DB with the migration applied:
```bash
npm run db:migrate:local
npx wrangler d1 execute <DB_BINDING> --local --command "EXPLAIN QUERY PLAN SELECT id, send_at FROM checkin_schedules WHERE status='scheduled' AND send_at <= ?1 ORDER BY send_at LIMIT 30"
```
Each step must say `SEARCH … USING INDEX` or `COVERING INDEX`, never `SCAN <table>`. A `SCAN` on a tiny fixed table, such as the 6 rooms or a single settings row, is acceptable, but note it in the PR. Paste the output into the PR or the progress log; this is the evidence for HITL gates.

## 3. Test it
Specs run against isolated D1 with all migrations applied (`vitest.config.ts` → `readD1Migrations` → `test/apply-migrations.ts`). Add a spec that reads or writes the new column or table. Run `npm test && node scripts/check-migrations.mjs`.

## 4. Apply it
| Env | Command | When |
|---|---|---|
| local | `npm run db:migrate:local` | while developing |
| dev / UAT | `npm run db:migrate:dev` (runs `check-config --deploy --target=dev` first) | after the PR merges to `dev`, before or with the deploy |
| prod | `npm run db:migrate:prod` | **only after the owner says yes**, during promotion to `main`, following `RELEASE_ORDER.md` |

- Run long `wrangler` commands in the background and poll them; heredocs can hang in zsh.
- After a prod apply, re-run the relevant row-count checks (`scripts/verify-prod-empty.mjs` style).

## 5. New database (new Worker)
1. `npx wrangler d1 create <name>-dev`, and later `<name>-prod` (owner approval).
2. Put the IDs in `wrangler.jsonc` (prod at the top level, `env.dev` repeated in full). `check-config.mjs` refuses placeholder or overlapping IDs.
3. Record the IDs **only** in `EI_PHASE1_STATUS.md` §2.
4. Add the DB to the `EI_ENVIRONMENTS.md` matrix.
