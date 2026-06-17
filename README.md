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
