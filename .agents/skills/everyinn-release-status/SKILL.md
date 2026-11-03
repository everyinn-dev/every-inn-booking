---
name: everyinn-release-status
description: Ship an Every Inn change and keep the shared memory honest — branch/commit conventions, verification commands per repo, push-to-deploy via Cloudflare Workers Builds (dev → UAT, main → prod), release order, rollback, and the mandatory updates to EI_PHASE1_STATUS.md (R1–R7) and the feature plan's Progress & Bug Log. Use at the start of any Every Inn session, before committing/pushing/promoting, when a task slice finishes, when a bug is found or fixed, or whenever someone says "deploy", "release", "promote to prod", "update status", "what's done".
---

# Every Inn — release and status discipline

Several AI agents take turns on this project. The docs repo is their shared memory, so a change that isn't recorded there is effectively lost. Deploying means pushing to git; nobody runs `wrangler deploy` from a laptop.

## Session start (R1)
1. Read `everyinn-platform-docs/EI_PHASE1_STATUS.md`, the contract `EVERY_INN_OTA_ARCHITECTURE_PLAN.md` §19–21, then the repo's `AGENTS.md`. If a feature plan exists (e.g. `EI_AI_RECEPTIONIST_IMPLEMENTATION_PLAN.md`), read its **Progress & Bug Log** too.
2. Run `git status` and `git branch` in each repo you will touch. App repos work on `dev`/`feat/*`; docs work on `main`.
3. Verify any claim before relying on it (R3). Status reports have been wrong before.

## While working
- Branch `feat/<slug>` or `fix/<slug>` from `dev`.
- Commit per task slice with `type(scope): summary [TASK-ID]`, for example `feat(holds): add extend endpoint [AI-1]`. End AI-made commits with the `Co-Authored-By` line.
- **Verify before pushing:**

| Repo | Command |
|---|---|
| Cores / agent-core | `npm run typecheck && npm test && npm run check:config && node scripts/check-migrations.mjs && npm run build:dry-run:dev` |
| Admin | `npm run lint && npx tsc --noEmit && npm test` |
| Landing | `npm run lint && npm run check` + `test/*.test.mjs` |
| Docs | `npm run verify:all && node scripts/sync-contracts.mjs --check` |

## Deploy flow
- Push `feat/*` → PR → `dev`. The merge deploys the `*-dev` Worker (UAT, which holds **real guest PII**).
- Smoke-test UAT: `node everyinn-platform-docs/scripts/uat-smoke.mjs` plus manual checks.
- **Promote to prod** with PR `dev` → `main` in `RELEASE_ORDER.md` order: cdp-core → booking-core → agent-core → admin & landing. Prod D1 migrations go first, and **only with explicit owner approval** (R6).
- **Rollback:** `npx wrangler rollback --env dev`, or `--env=""` for prod. Migrations are fixed forward, never reverted.

## Ending a task slice (R4) — always do both
1. **Feature plan Progress & Bug Log** (e.g. `EI_AI_RECEPTIONIST_IMPLEMENTATION_PLAN.md` §Progress):
   - set the task row to `DONE`/`IN-PROGRESS`/`BLOCKED` with the date, commit SHA and branch;
   - for each bug, add `BUG-n | found in | symptom | root cause | fix commit | status`.
2. **`EI_PHASE1_STATUS.md`:**
   - task board row (status words only: `DONE`, `IN-PROGRESS`, `BLOCKED`, `TODO`, `DEFERRED` — R5);
   - risks (§6) if something new appeared;
   - "Last verified" date;
   - a §9 changelog row.

   Never renumber task IDs (R7). Never copy resource IDs into other docs (R2).

## Never
- Point a dev Worker at a prod DB.
- Commit secrets, `.dev.vars`, guest PII, `.backfill/` or `.sim/`.
- Create or modify a prod Cloudflare resource without the owner.
