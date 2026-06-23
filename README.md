# Survival Receipts

Survival Receipts is a prototype for measuring whether AI-assisted engineering
work survives contact with review, CI, merge, and production.

The metric is simple on purpose:

```text
survived shipped change per dollar of AI spend
```

The product bet is that engineering leaders do not need another dashboard that
says how many tokens were consumed. They need a receipt for what the tokens
produced, and whether that work stayed shipped after the team had to review,
repair, and maintain it.

## Why this exists

The exploration in [exploration.md](./exploration.md) argues that AI spend is
growing faster than the tooling used to govern it. Existing tools mostly answer
"what did we spend?" Observability products, gateways, and provider dashboards
track inputs: tokens, calls, latency, model mix, and cost.

That leaves the harder question open:

```text
Did the AI spend produce durable work?
```

For AI-heavy engineering teams, this is the most instrumentable version of the
ROI problem. GitHub already records PRs, reviews, CI failures, merges, follow-up
commits, reverts, defects, and hotfixes. Those signals do not prove business
ROI, but they do expose whether AI work turned into shipped software or just
moved cost from typing to reviewing.

## The feature

The prototype is a dashboard for AI-assisted pull requests.

It ranks PRs by survived semantic hunks per $100 of AI spend, then generates a
GitHub-style receipt for each PR:

- AI spend and attribution source
- survived semantic hunks
- impact density
- cleanup tax
- review and post-merge pressure signals
- verdict: `durable`, `watch`, or `sludge`

The receipts can become PR comments, Slack digests, team scorecards, or an
executive rollup later. The important object is the receipt. It makes the score
auditable instead of turning it into a magic number.

## Local CLI backtest

The first week-one build target is a local CLI that produces a static Markdown
report from git history:

```bash
pnpm survival scan --repo /path/to/repo --survival-days 30 --window-days 30 --out reports/my-repo
```

Use one value for the familiar matured report. Use a comma-separated list for a
survival curve:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --survival-days 1,7,15,30 \
  --window-days 7 \
  --out reports/my-repo
```

Add `--json-out` when another tool needs the raw scan result:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --survival-days 30 \
  --window-days 30 \
  --out reports/my-repo \
  --json-out reports/my-repo
```

For a first pass on a larger repo, start smaller:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --survival-days 30 \
  --window-days 30 \
  --limit 50 \
  --out reports/my-repo
```

Use `inspect` when you want to build an attribution config or audit what the
CLI can see before running a survival scan:

```bash
pnpm survival inspect \
  --repo /path/to/repo \
  --as-of 2026-06-01 \
  --survival-days 30 \
  --window-days 30
```

It prints a Markdown inventory of unique commit authors, detected GitHub
usernames from noreply emails, and PR numbers with inferred titles. It does not
run blame or score survival.

`--as-of` is the report cutoff and defaults to the current time.
`--survival-days` says how old a change must be before the scanner judges it.
It accepts one checkpoint, such as `30`, or a list, such as `1,7,15,30`.
`--window-days` says how many days of mature source changes to include.

With `--as-of 2026-06-01 --survival-days 30 --window-days 7`, the scanner looks
at changes from 2026-04-25 through 2026-05-02. Those are the latest 7 days of
changes that had a full 30 days to survive by 2026-06-01.

With `--as-of 2026-06-01 --survival-days 1,7,15,30 --window-days 7`, it uses
the same source window and scores each change at 1, 7, 15, and 30 days.

Use `--as-of` when you want to backtest as of a past date:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --as-of 2026-06-01 \
  --survival-days 30 \
  --window-days 30 \
  --out reports/q1
```

Use `survival.config.json` in the scanned repo when deterministic markers miss
AI-authored work you already know about:

```json
{
  "ai": {
    "githubUsernames": ["cto-new[bot]", "claude"],
    "prNumbers": [1595, 1720]
  }
}
```

Configured PR numbers and GitHub usernames count as AI with 100% attribution
confidence. The default config path is `survival.config.json` in the scanned
repo root. You can also pass a file explicitly:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --config /path/to/survival.config.json \
  --survival-days 30 \
  --window-days 30 \
  --out reports/configured
```

PR-number overrides require a commit subject with a PR number, such as squash
commits ending in `(#123)` or merge commits containing `Merge pull request
#123`. GitHub username overrides match exact author or committer names, plus
GitHub noreply emails such as `12345+cto-new[bot]@users.noreply.github.com`.

The CLI runs entirely on the machine that already has repo access. It does not
call GitHub, model providers, or a hosted backend. That is the point of this
slice: produce a receipt a skeptical engineer can audit from local git facts.

The first scanner uses added-line survival:

```text
surviving added lines / added lines
```

For each single-parent commit, it finds the commit at the survival date and
runs `git blame -M`. A line survives when the survival-date blame still
attributes it to the source commit.

The report compares deterministic AI-marked changes against human changes in
the same repo and window. AI markers are intentionally narrow:

- `Co-authored-by` trailers naming Claude, Anthropic, OpenAI, Codex, Copilot,
  Cursor, Devin, or an agent
- commit author or committer identities that look like AI agents or bots
- explicit commit-message labels such as `ai-assisted`, `claude-code`,
  `cursor`, `codex`, or `copilot`

The report also splits AI and human survival by added-line size bucket:

```text
tiny:   1-20 added lines
small:  21-100 added lines
medium: 101-500 added lines
large:  501+ added lines
```

This keeps large PRs from silently dominating the headline number. The raw
overall score stays in the report, but the bucket table is the fairer first
place to compare AI and human changes.

This version skips merge commits because proper support needs branch
reconstruction. Squash-merged PRs work well because the squash commit is the
auditable unit. It also skips generated files, lockfiles, build output, vendored
code, sourcemaps, snapshots, binary assets, and media files.

It also has runtime guardrails. By default it skips a change when it touches
more than 25 included files, adds more than 1500 included lines, or has one file
with more than 300 added lines. Each `git blame` call has a 15 second timeout.
The report lists skipped changes and the reason. Use these flags when a repo
needs different limits:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --survival-days 30 \
  --window-days 30 \
  --max-files 60 \
  --max-added-lines 5000 \
  --max-file-added-lines 1200 \
  --blame-timeout-ms 60000 \
  --out reports/my-repo
```

The default blame mode uses move detection only because copy detection can be
much slower on real repos. Use `--copy-detection` for a deeper scan when runtime
matters less than catching copied lines.

Estimated AI cost is a placeholder based on changed lines and file count. It is
there so the report has the shape of a receipt, not because the scanner knows
real provider spend yet. Replace it with Claude Code logs, gateway traces, or
provider exports when those are available.

## GitHub Action

The GitHub Action in [action.yml](./action.yml) wraps the same CLI. It runs in
GitHub Actions against the checked-out repo, writes the Markdown report to the
job summary, uploads Markdown and JSON reports as artifacts, and can optionally
POST the JSON report to a backend.

Once this repo is public at `recallnet/survival-receipts`, users install the
action by referencing a tag or branch from their workflow:

```yaml
- uses: recallnet/survival-receipts@v0
```

Publish a stable major-version tag when cutting the first usable release:

```bash
git tag v0.1.0
git tag v0
git push origin v0.1.0 v0
```

Use it first as a manual backtest:

```yaml
name: Survival backtest

on:
  workflow_dispatch:
    inputs:
      as-of:
        required: false
        default: ""
      survival-days:
        required: true
        default: "30"
      window-days:
        required: true
        default: "7"

jobs:
  survival:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: recallnet/survival-receipts@v0
        with:
          as-of: ${{ inputs.as-of }}
          survival-days: ${{ inputs.survival-days }}
          window-days: ${{ inputs.window-days }}
```

The other useful mode is a scheduled report over a mature window:

```yaml
name: Weekly survival report

on:
  schedule:
    - cron: "0 14 * * 1"

jobs:
  survival:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: recallnet/survival-receipts@v0
        with:
          survival-days: "30"
          window-days: "7"
          artifact-name: weekly-survival-report
```

With `survival-days: "30"` and `window-days: "7"`, each weekly run scores the
latest 7 days of changes that had 30 days to survive. With
`survival-days: "1,7,15,30"`, the same run also shows the earlier survival
curve for that cohort. That keeps newly merged code out of the report until it
is mature enough to judge. A PR-time action is less useful for this metric
because a newly merged PR cannot have a 30 day survival score yet. A later
version can record a pending receipt on merge, then score it once the survival
period matures.

To connect the action to a hosted app, pass a backend upload URL and API key:

```yaml
- uses: recallnet/survival-receipts@v0
  with:
    survival-days: "30"
    window-days: "7"
    upload-url: https://app.example.com/api/survival-runs
    api-key: ${{ secrets.SURVIVAL_API_KEY }}
```

The backend receives the JSON report. Source code stays in the GitHub Actions
runner. If the runner is self-hosted, the scan never leaves the customer's
infrastructure except for the derived JSON data they choose to upload.

## Important concepts

**AI change survival.** The share of AI-assisted change that remains useful
after review, merge, and later maintenance. A change that gets rewritten by a
reviewer, repeatedly fails CI, causes hotfixes, or gets reverted has poor
survival.

**Semantic hunk.** A unit of meaningful code change. This is better than lines
of code because it does not reward formatting churn, generated bulk edits, or
large files for their own sake. The prototype uses mock semantic hunk counts.
A real integration would compute them from parsed diffs or a syntax-aware diff
service.

**Impact density.** Durable output per dollar:

```text
survived semantic hunks / AI spend
```

The dashboard normalizes this as survived hunks per $100. That gives teams a
number they can compare across repos, agents, and time windows.

**Cleanup tax.** The portion of AI spend that appears to have turned into review
drag or post-merge cleanup:

```text
AI spend * (1 - survival ratio)
```

This is not an invoice. It is a pressure estimate that names where the hidden
cost probably moved.

**Attribution confidence.** A score for how much to trust the AI-to-PR link.
Gateway traces are stronger than branch timing. Local CLI logs and declared PR
tags sit in the middle. Weak attribution should lower trust in the receipt, not
hide the receipt.

## The current algorithm

The scoring code lives in [src/domain/survival.ts](./src/domain/survival.ts).
It is intentionally transparent.

For each PR and time window, the algorithm reads:

- AI cost, provider, model, sessions, tokens, source, and confidence
- review signals: semantic hunks, review comments, revision rounds, reviewer
  rewrite percentage, and CI failures
- survival signals: hunk survival, post-merge churn, follow-up edits, linked
  defects, hotfixes, reverts, and evidence confidence

The prototype supports four windows:

- `forecast`
- `day7`
- `day14`
- `day30`

### Step 1: compute review drag

Review drag estimates how much useful AI output was lost before merge.

```text
comments per hunk       * 0.045
+ author revision rounds * 0.045
+ reviewer rewrite pct   * 0.32
+ CI failures            * 0.035
```

The result is clamped between `0` and `0.62`.

The cap matters. Review drag can be severe, but a hard cap prevents one noisy
signal from erasing the whole PR before post-merge evidence has a chance to
weigh in.

### Step 2: compute post-merge drag

Post-merge drag estimates how much shipped work decayed after merge.

```text
post-merge churn    * 0.42
+ follow-up edits   * 0.035
+ linked defects    * 0.13
+ linked hotfixes   * 0.19
+ reverts           * 0.42
```

The result is clamped between `0` and `0.85`.

Reverts and churn carry heavy weight because they are hard to explain away.
They mean the team paid maintenance cost after the AI-assisted PR shipped.

### Step 3: compute survival ratio

```text
hunk survival * (1 - review drag) * (1 - post-merge drag)
```

This makes the metric multiplicative. A PR needs to survive all three layers:
the raw diff, human review, and later maintenance.

### Step 4: compute durable output

```text
survived hunks = semantic hunks * survival ratio
survival score = survival ratio * 100
impact density = survived hunks / AI spend * 100
dollars per survived hunk = AI spend / survived hunks
cleanup tax = AI spend * (1 - survival ratio)
```

The dashboard sorts PRs by `impact density`.

### Step 5: assign verdicts

```text
74 to 100: durable
52 to 73:  watch
0 to 51:   sludge
```

The names are deliberately blunt. A metric like this is useful only if it can
start a hard conversation quickly.

### Step 6: aggregate the workspace

Workspace and team scores are derived from PR-level receipts:

- total AI spend
- total survived hunks
- survived hunks per $100
- dollars per survived hunk
- cleanup tax
- weighted average survival score
- attribution confidence weighted by spend
- top cleanup leaks

Survival score is weighted by semantic hunks, not by PR count. A tiny durable PR
should not cancel out a large expensive PR that created cleanup work.

## Why this is defensible

This prototype does not claim to solve causal ROI. That is the trap. The clean
chain from token spend to P&L will usually be polluted by every other thing the
team shipped, changed, or broke in the same period.

The defensible claim is narrower and stronger:

```text
For AI-heavy engineering teams, durable shipped change is a better unit of value
than tokens, lines of code, PR count, or claimed hours saved.
```

That claim has teeth for a few reasons.

First, it fights tokenmaxxing directly. Token volume, generated lines, and PR
count are easy to inflate. Survival is harder to fake because the work has to
pass review, merge cleanly, avoid reverts, avoid hotfixes, and remain in the
codebase.

Second, it uses existing engineering exhaust. GitHub, CI, issue trackers, and
deployment systems already emit most of the evidence. The product does not need
every company to agree on a business KPI before it can say something useful.

Third, it makes hidden cost visible. Bad AI work does not disappear. It becomes
review threads, rewrite time, broken builds, follow-up PRs, hotfixes, churn, and
reverts. The receipt turns those costs into a shared object that engineering and
finance can inspect.

Fourth, it is cross-provider by design. Provider dashboards can show OpenAI or
Anthropic usage. They are unlikely to tell a CTO that their own model usage
created review sludge. This metric sits above providers and attaches spend to
outcomes in the work graph.

Fifth, it can compound into benchmark data. Once many teams compute the same
receipt shape, the product can compare impact density by repo type, agent,
team, workflow, and change class. That is where the metric gets more useful
over time.

## What would make it real

The prototype uses mock data. A production version would need four capture
paths:

- GitHub app for PRs, reviews, diffs, commits, reverts, and linked issues
- CI integration for failed checks and reruns
- AI spend capture from CLI logs, gateway traces, provider exports, or declared
  PR tags
- issue tracker integration for defects, hotfixes, and follow-up work

The first real version should not chase every signal. The smallest credible
version is:

1. GitHub PR data
2. declared AI-assisted PR label
3. AI cost imported from a CSV or CLI log
4. 14-day and 30-day hunk survival
5. PR comment receipt

That would be enough to test whether teams care about the receipt and whether
the score matches what reviewers already feel.

## Current limits

The weights are hand-tuned. They are meant to be legible, not final.

Semantic hunks are mocked. A real implementation needs syntax-aware diffing or
a stable hunk classifier.

Attribution is only modeled. Real teams will have mixed sources with uneven
quality.

The metric can still be gamed. Teams could split PRs, avoid declaring AI use, or
under-link defects. The defense is not that gaming is impossible. The defense is
that gaming survival requires changing engineering behavior in ways that are
more visible than inflating token usage.

## Run the prototype

This repo uses pnpm, TypeScript, React, Effect, Vite, and shadcn/ui-style
components.

The project pins Node 22 with mise because the machine default Node 26 path made
pnpm unstable during setup.

```bash
mise trust
corepack pnpm install
corepack pnpm dev
```

If your shell does not auto-activate mise:

```bash
mise exec node@22.22.2 -- corepack pnpm install
mise exec node@22.22.2 -- corepack pnpm dev
```

Verification:

```bash
corepack pnpm test --run
corepack pnpm build
```
