# Survival Receipts handoff

Last updated: 2026-06-23

This project has two repos:

- Public CLI, UI, and GitHub Action: `/Users/aaron/code/recall-explorations/roi`
- Private backend: `/Users/aaron/code/recall-explorations/survival-backend`

The public repo remote is `git@github.com:recallnet/survival-receipts.git` on branch `main`.
The backend repo is separate and currently appears uncommitted locally, with all files untracked.

Use pnpm through mise:

```bash
mise exec node@22.22.2 -- corepack pnpm test --run
mise exec node@22.22.2 -- corepack pnpm build
```

For the backend:

```bash
mise exec node@22.22.2 -- corepack pnpm typecheck
mise exec node@22.22.2 -- corepack pnpm test --run
mise exec node@22.22.2 -- corepack pnpm db:generate
mise exec node@22.22.2 -- corepack pnpm db:migrate
```

Docker was not running when backend work was done, so migrations were generated and typechecked but not applied to a live database.

## Product model

The core measurement is code survival by checkpoint:

```text
repository + commit sha + survival days
```

Examples:

```text
commit abc, 1-day survival: scored
commit abc, 7-day survival: scored
commit abc, 15-day survival: scored
commit abc, 30-day survival: pending
```

Pending is a real state. It means the commit has not reached that survival age yet. Pending checkpoints should be stored and shown, but not included in survival ratios.

Skipped is different. It means the scanner could not score the change or checkpoint, usually because of merge commits, generated files, no included added lines, oversized changes, or blame failure.

## CLI behavior

Main command:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --survival-days 1,7,15,30 \
  --window-days 7 \
  --out reports/demo \
  --json-out reports/demo
```

`--survival-days` accepts one checkpoint or a comma-separated list. The scanner creates one checkpoint result per requested survival day for every scanned change.

Window mode uses the smallest requested checkpoint to pick the source window. With `--survival-days 1,7,15,30`, a change only needs to be 1 day old to enter the report. Older checkpoints are scored when available. Future checkpoints are marked pending.

Range mode exists for backend cursor work:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --from-commit abc123 \
  --to-commit def456 \
  --survival-days 1,7,15,30
```

`--from-commit` is exclusive. `--to-commit` is inclusive.

`limit` is a safety cap. In window mode it caps how many commits `git log` returns. In range mode it refuses to run if the range has more commits than `--limit`, because silently truncating a cursor range would lose commits.

The report currently chooses the latest checkpoint with any scored data as the headline. If 30-day data is pending but 15-day data exists, the headline uses 15 days and the report lists 30-day pending counts.

Relevant files:

- `src/cli/args.ts`
- `src/cli/window.ts`
- `src/cli/git.ts`
- `src/cli/scanner.ts`
- `src/cli/report.ts`
- `src/cli/main.ts`

Tests to look at:

- `src/cli/scanner.test.ts`
- `src/cli/report.test.ts`
- `src/cli/args.test.ts`

## Attribution config

The scanner detects AI changes through deterministic markers:

- AI-looking co-author trailers
- bot or agent author/committer identities
- commit message labels like `claude-code`, `cursor`, `codex`, `copilot`
- configured GitHub usernames and PR numbers

Repo-level overrides live in `survival.config.json`:

```json
{
  "ai": {
    "githubUsernames": ["cto-new[bot]", "claude"],
    "prNumbers": [1595, 1720]
  }
}
```

Configured PR numbers and GitHub usernames count as AI with full confidence.

## GitHub Action behavior

The action is `action.yml`. It wraps the CLI.

For no-backend installs, use:

```yaml
name: Daily survival receipts

on:
  schedule:
    - cron: "0 14 * * *"
  workflow_dispatch:

jobs:
  survival:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: recallnet/survival-receipts@main
        with:
          survival-days: "1,7,15,30"
          window-days: "1"
          limit: "1000"
          quiet: "true"
          upload-artifact: "true"
          artifact-name: survival-receipts
```

Use `@main` until a `v0` tag exists. GitHub Actions failed with `@v0` because no tag had been published.

To publish the stable action ref later:

```bash
git checkout main
git pull --ff-only
git tag v0
git push origin v0
```

Cursor mode exists, but it is not the best onboarding path yet. Hosted uploads can
now use GitHub Actions OIDC instead of copied API keys:

```yaml
permissions:
  contents: read
  id-token: write

with:
  cursor-mode: "true"
  survival-days: "1,7,15,30"
  limit: "1000"
  upload-url: https://app.example.com/api/runs
```

Current cursor mode asks `/api/cursor` for the last processed SHA, computes a mature head locally, runs range mode, and uploads an envelope to `/api/runs`.

Important caveat: cursor mode still computes mature head using the largest requested survival day. That is conservative and does not take advantage of pending checkpoints for young repos. Window mode is now pending-aware. Cursor mode should be made pending-aware before treating it as the main scheduled backend path.

## Backend architecture

Backend uses Effect HTTP API and Drizzle.

Main files:

- `src/api/SurvivalApi.ts`
- `src/api/schemas.ts`
- `src/db/schema.ts`
- `src/services/RunIngestionService.ts`
- `src/services/RepoSummaryService.ts`
- `src/services/GitHubWebhookService.ts`
- `src/handlers/RunsHandlers.ts`
- `src/handlers/CursorHandlers.ts`
- `src/handlers/ReposHandlers.ts`
- `src/handlers/GitHubWebhookHandlers.ts`

Endpoints:

- `GET /health`
- `POST /api/runs`
- `POST /api/cursor`
- `POST /api/github/webhook`
- `GET /api/runs/:runId`
- `GET /api/repos`
- `GET /api/repos/:repoId/summary`
- `GET /api/repos/:repoId/runs`

Auth for `POST /api/runs` and `POST /api/cursor` now accepts either the local
static bearer token or GitHub Actions OIDC. OIDC uploads must include GitHub run
context, must match the token `repository` claim, and must be for a repository
stored from an active GitHub App installation webhook.

The raw-body webhook endpoint is mounted as middleware before the Effect HTTP API
so signature verification uses the exact bytes GitHub sent. Required settings for
this slice are `GITHUB_WEBHOOK_SECRET` and matching `GITHUB_OIDC_AUDIENCE` values
in the backend and action.

`POST /api/runs` accepts either a raw CLI report or the GitHub Action envelope:

```json
{
  "schemaVersion": "survival.run.v1",
  "source": "github_action",
  "github": {
    "owner": "recallnet",
    "repo": "survival-receipts",
    "repository": "recallnet/survival-receipts"
  },
  "report": {}
}
```

The latest migration is:

```text
src/db/migrations/20260623193803_cultured_maria_hill/
```

The important backend schema choice is `survival_checkpoints`:

```text
repository_id + commit_sha + survival_days
```

That unique key makes checkpoint measurements idempotent. Ingestion upserts each checkpoint. Runs are ingestion batches, not the durable identity of a measurement.

`survival_checkpoints` has:

- `latest_run_id`
- `latest_change_id`
- `repository_id`
- `commit_sha`
- `survival_days`
- `survival_date`
- `target_sha`
- `surviving_lines`
- `survival_ratio`
- `status`
- `skip_reason`
- `file_survival`
- `created_at`
- `updated_at`

`latest_run_id` and `latest_change_id` use `ON DELETE SET NULL`. This lets a duplicated run be deleted/replaced without deleting the durable checkpoint fact.

## Current backend limitations

Repo summaries still mostly think in terms of the latest run. That is okay for the first API slice, but the future frontend should query checkpoint facts across the repo, not only the latest ingestion batch.

Ingestion blindly upserts incoming checkpoint status. A rerun with an older `as-of` could downgrade a scored checkpoint to pending. In normal scheduled use `as-of` moves forward, so this should not happen. Still, the backend should probably refuse to overwrite `scored` with `pending` unless explicitly requested.

Cursor state is derived from latest successful range-mode runs. There is no explicit cursor table and no cursor reset endpoint.

There is no live database test yet. Current tests validate Effect schemas and
webhook signature verification only.

## Git and history edge cases

Cursor mode assumes:

```text
lastProcessedSha is an ancestor of matureHeadSha
```

If history is rewritten, the action fails instead of guessing. That is the right default. Future recovery should rely on checkpoint idempotency and a wider rescan.

Range mode plus checkpoint upsert means a conservative rescan is safe at the measurement level. The backend can ignore or replace duplicate checkpoint facts.

## Suggested next work

1. Commit and push the public repo, then tag `v0` once the action should be installable as `recallnet/survival-receipts@v0`.

2. Run the action in a test repo using `@main` first. Verify the job summary, Markdown artifact, JSON artifact, and pending checkpoint wording.

3. Make cursor mode pending-aware. The action should process commits old enough for the smallest requested checkpoint, not the largest, or it should ask the backend for missing mature commit/checkpoint pairs.

4. Add backend database tests. The most important test is ingesting the same commit/checkpoint twice and proving `survival_checkpoints` still has one row with updated values.

5. Add a guard against downgrading `scored` checkpoint facts to `pending`.

6. Build backend queries for the frontend around checkpoint facts:

```text
repo
commit sha
survival days
status
kind
added lines
surviving lines
commit date
PR number
AI attribution
```

7. Add a cursor reset endpoint or admin command. History rewrites will need it.

8. Add range batching for large backlogs. Today range mode fails when the range exceeds `--limit`.

9. Add GitHub user login and dashboard authorization. The backend has app
installation webhooks and OIDC ingestion, but no human OAuth/session flow yet.

10. Decide whether skipped checkpoints should also be durable facts forever. They are currently stored and upserted like scored and pending measurements.

## Known verification commands

Public repo:

```bash
mise exec node@22.22.2 -- corepack pnpm test --run
mise exec node@22.22.2 -- corepack pnpm build
```

Backend:

```bash
mise exec node@22.22.2 -- corepack pnpm typecheck
mise exec node@22.22.2 -- corepack pnpm test --run
```

Action YAML parse:

```bash
ruby -e 'require "yaml"; YAML.load_file("action.yml"); puts "action.yml ok"'
```

Useful smoke for pending checkpoints:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --as-of 2026-01-30T12:00:00Z \
  --survival-days 1,7,15,30 \
  --window-days 30 \
  --out reports/smoke \
  --json-out reports/smoke
```

Look for 30-day pending rows in `survival-report.json`.
