# Backend web app brief

This document describes the backend web app for Survival Receipts.

The CLI and GitHub Action run inside the customer's environment. They inspect
repos, compute deterministic evidence, and push a compact payload to the web
app. The web app stores those facts, aggregates them over time, and turns them
into org, repo, team, user, agent, and model-level reports.

The app should feel less like a generic analytics dashboard and more like a
forensic record of what happened after AI-assisted code was merged.

## Product job

The backend app answers five questions:

1. Is AI-assisted code surviving better or worse than human-authored code in
   this org?
2. Which repos, teams, users, agents, and models produce the most durable AI
   changes?
3. Where is AI creating hidden cleanup work after merge?
4. Which individual PRs prove the point, either positively or negatively?
5. Can an engineering leader defend a budget decision with auditable evidence?

The app does not need to store source code by default. It should store facts,
links, hashes, counts, markers, receipts, and derived metrics.

## Core design principle

The scanner is the data plane. The web app is the evidence archive and reporting
system.

That distinction matters for trust. Private code stays inside the customer's
repo, CI runner, laptop, or self-hosted runner. The hosted app receives derived
evidence:

- PR IDs and URLs
- commit SHAs
- merge timestamps
- file path hashes or optionally plain file paths
- hunk fingerprints
- survival counts
- review and CI facts
- AI attribution markers
- cost estimates or imported spend events
- confidence scores
- generated receipts

The app should make this boundary visible in the UI. A buyer should be able to
see what the product stores and what it does not store.

## Users

### Engineering executive

VP Engineering, Head of Engineering, CTO, or founder at an AI-heavy software
company. They need a credible read on whether AI coding tools deserve more
budget, tighter controls, or a different rollout plan.

They care about org-level trends, budget memos, agent comparisons, and a few
high-signal examples they can discuss with staff engineers.

### Engineering productivity or DevEx lead

The person who owns tooling, measurement, and adoption. They configure
integrations, validate scan quality, watch coverage, and prepare recurring
reports.

They care about data quality, repo coverage, scanner versions, confidence
scores, and drill-downs that survive scrutiny.

### Staff engineer or repo maintainer

The skeptic. They will not trust a black-box grade for their repo. They inspect
receipt math, look at examples, and challenge whether the metric matches what
reviewers felt.

They care about PR-level evidence, blame rules, exclusions, attribution markers,
and whether the tool catches obvious junk.

### Finance or operations partner

They do not need to inspect every PR. They need a clean budget narrative that
connects spend to durable output without pretending it proves full business ROI.

They care about renewal views, spend by tool, trend lines, and PDF or board
memo exports.

### Security or platform admin

They decide whether this can run in the org. They need to understand data
boundaries, token scopes, retention, audit logs, and whether source code leaves
their environment.

They care about install permissions, upload schemas, secret handling, retention
controls, and data redaction.

## Data sources

### CLI upload

A local developer or DevEx lead runs a scan against one or more repos and pushes
the result to the backend.

Useful for:

- backtests
- private repos with strict access rules
- early pilots
- one-off reports
- self-hosted enterprise workflows

### GitHub Action upload

The action runs on a schedule or after merges. It analyzes the repo inside the
GitHub runner and uploads derived facts.

Useful for:

- continuous measurement
- PR comments
- daily or weekly org rollups
- trend charts
- policy checks

### GitHub App context

Optional but useful once the product needs easier installation, repo selection,
webhooks, comments, checks, and org identity.

The app does not need to clone code if the action already uploads scan results.
It can manage permissions, comments, and account mapping.

### Spend imports

Spend can come from CLI logs, provider exports, gateway exports, or manual CSVs.
The first version can accept estimated spend from the scanner. Later versions
can reconcile estimates against invoices.

### Human baseline scans

The same survival algorithm should run on non-AI PRs in the same repo and time
window. This is not a secondary feature. The comparison is what turns a raw
survival rate into a verdict.

## Main data types

### Organization

Represents the customer account.

Important fields:

- `id`
- `name`
- `billingPlan`
- `dataRetentionDays`
- `defaultRedactionMode`
- `createdAt`

Used for:

- account boundaries
- billing
- permissions
- org-level reporting
- retention controls

### User

Represents a human using the web app.

Important fields:

- `id`
- `email`
- `name`
- `role`
- `lastSeenAt`

Used for:

- login
- report access
- audit events
- saved views

### Membership

Connects a user to an organization.

Important fields:

- `orgId`
- `userId`
- `role`
- `teamIds`
- `repoScopes`

Used for:

- role-based access
- team-scoped dashboards
- admin boundaries

### Team

Represents a functional engineering team.

Important fields:

- `id`
- `orgId`
- `name`
- `repoIds`
- `githubTeamSlug`
- `managerUserId`

Used for:

- team rollups
- manager views
- budget and adoption comparisons

### Repository

Represents one code repo tracked by the product.

Important fields:

- `id`
- `orgId`
- `provider`
- `providerRepoId`
- `owner`
- `name`
- `visibility`
- `defaultBranch`
- `languageMix`
- `riskTier`
- `firstScannedAt`
- `lastScannedAt`

Used for:

- repo health pages
- scanner configuration
- PR receipt grouping
- coverage reporting

### Repository configuration

Stores scanner settings for a repo.

Important fields:

- `repoId`
- `scanSchedule`
- `survivalWindows`
- `aiMarkers`
- `botAuthorAllowlist`
- `excludedPaths`
- `excludedFileTypes`
- `pathRedactionMode`
- `minPrAgeDays`
- `humanBaselineEnabled`

Used for:

- deterministic scan rules
- auditability
- reducing false positives
- explaining why PRs were included or excluded

### Ingestion source

Represents a trusted upload path.

Important fields:

- `id`
- `orgId`
- `kind`, such as `cli`, `github_action`, `github_app`, or `api`
- `displayName`
- `repoScopes`
- `createdByUserId`
- `lastUsedAt`
- `revokedAt`

Used for:

- upload authorization
- source-specific rate limits
- audit logs
- stale integration warnings

### Scan run

One execution of the CLI, GitHub Action, or hosted worker.

Important fields:

- `id`
- `orgId`
- `repoId`
- `sourceId`
- `scannerVersion`
- `commitSha`
- `startedAt`
- `completedAt`
- `status`
- `mode`, such as `backtest`, `scheduled`, `pr`, or `manual`
- `lookbackStart`
- `lookbackEnd`
- `survivalWindowDays`
- `uploadSchemaVersion`

Used for:

- run history
- debugging bad reports
- comparing scanner versions
- proving when data was captured

### Scan coverage

Summarizes how complete a scan was.

Important fields:

- `scanRunId`
- `prsSeen`
- `prsEligible`
- `prsExcluded`
- `aiPrsDetected`
- `humanPrsDetected`
- `prsTooYoung`
- `pathsExcluded`
- `coverageScore`
- `warnings`

Used for:

- confidence banners
- onboarding checklist
- "why is this report thin?" explanations

### Pull request snapshot

The PR-level record as seen at scan time.

Important fields:

- `id`
- `orgId`
- `repoId`
- `providerPrId`
- `number`
- `title`
- `url`
- `authorLogin`
- `createdAt`
- `mergedAt`
- `mergeCommitSha`
- `baseBranch`
- `headBranch`
- `labels`
- `changedFiles`
- `linesAdded`
- `linesDeleted`
- `semanticHunks`
- `changeClass`
- `isAiAssisted`
- `isHumanBaseline`

Used for:

- receipt pages
- cohort building
- repo detail pages
- PR search

### Contributor

Represents a GitHub user, bot, or mapped internal employee.

Important fields:

- `id`
- `orgId`
- `providerLogin`
- `displayName`
- `kind`, such as `human`, `bot`, `agent`, or `unknown`
- `teamIds`
- `employmentStatus`

Used for:

- team rollups
- bot detection
- user-level views
- author attribution

### AI attribution

Explains why the product thinks a PR involved AI.

Important fields:

- `prSnapshotId`
- `isAiAssisted`
- `confidence`
- `markers`
- `markerSource`, such as `coauthor_trailer`, `bot_author`, `label`,
  `branch_name`, `cli_log`, `gateway_trace`, or `manual_override`
- `agentName`
- `provider`
- `model`
- `sessionCount`
- `inputTokens`
- `outputTokens`
- `estimatedCostUsd`

Used for:

- trust in the receipt
- agent and model comparisons
- spend calculations
- false-positive review

### Spend event

An imported or estimated AI cost event.

Important fields:

- `id`
- `orgId`
- `repoId`
- `prSnapshotId`
- `source`, such as `scanner_estimate`, `cli_log`, `gateway`, `provider_csv`,
  or `manual`
- `provider`
- `model`
- `agentName`
- `inputTokens`
- `outputTokens`
- `costUsd`
- `occurredAt`
- `confidence`

Used for:

- spend reconciliation
- impact density
- renewal reports
- cost by tool

### Review evidence

Measures pre-merge friction.

Important fields:

- `prSnapshotId`
- `reviewComments`
- `reviewThreads`
- `authorRevisionRounds`
- `reviewerRewritePct`
- `ciFailures`
- `ciReruns`
- `timeToFirstReviewMinutes`
- `timeToMergeMinutes`
- `approverCount`

Used for:

- review drag
- staff engineer inspection
- team process diagnostics

### Survival evidence

Measures what happened after merge.

Important fields:

- `prSnapshotId`
- `windowDays`
- `hunksAdded`
- `hunksSurvived`
- `hunkSurvivalRatio`
- `linesAdded`
- `linesSurvived`
- `lineSurvivalRatio`
- `postMergeChurnRatio`
- `followUpTouchCount`
- `defectLinkCount`
- `hotfixLinkCount`
- `revertCount`
- `evidenceConfidence`
- `computedAt`

Used for:

- survival score
- AI versus human comparison
- durable change rankings
- cleanup detection

### Survival receipt

The canonical product object. A receipt is the auditable summary for one PR at
one survival window.

Important fields:

- `id`
- `orgId`
- `repoId`
- `prSnapshotId`
- `windowDays`
- `verdict`, such as `durable`, `watch`, or `sludge`
- `survivalScore`
- `survivedHunks`
- `impactDensity`
- `dollarsPerSurvivedHunk`
- `cleanupTaxUsd`
- `reviewDrag`
- `postMergeDrag`
- `attributionConfidence`
- `evidenceConfidence`
- `riskDrivers`
- `receiptMarkdown`
- `createdAt`

Used for:

- PR comments
- receipt detail pages
- executive examples
- saved reports
- API exports

### Human baseline

The matching survival data for non-AI PRs.

Important fields:

- `orgId`
- `repoId`
- `teamId`
- `windowDays`
- `periodStart`
- `periodEnd`
- `humanPrCount`
- `humanSurvivalScore`
- `humanHunkSurvivalRatio`
- `humanPostMergeChurnRatio`
- `humanReviewDrag`

Used for:

- repo-specific comparison
- "AI dies 1.8x faster here" statements
- avoiding meaningless raw percentages

### Period rollup

Aggregated metrics for a time bucket.

Important fields:

- `orgId`
- `scopeType`, such as `org`, `team`, `repo`, `user`, `agent`, `model`, or
  `change_class`
- `scopeId`
- `periodStart`
- `periodEnd`
- `windowDays`
- `aiPrCount`
- `humanPrCount`
- `aiSpendUsd`
- `survivedHunks`
- `impactDensity`
- `cleanupTaxUsd`
- `aiSurvivalScore`
- `humanSurvivalScore`
- `relativeSurvival`
- `coverageScore`

Used for:

- trend charts
- rankings
- health summaries
- renewal reports

### Cohort

A saved group of PRs used for comparison.

Important fields:

- `id`
- `orgId`
- `name`
- `filters`
- `createdByUserId`
- `createdAt`

Example cohorts:

- AI-assisted frontend PRs in the last 90 days
- Claude Code PRs touching billing code
- human baseline PRs in the same repos
- PRs with more than three CI failures

Used for:

- deeper analysis
- saved comparisons
- benchmark views

### Policy

A rule that watches for a survival pattern.

Important fields:

- `id`
- `orgId`
- `name`
- `scope`
- `condition`
- `action`, such as `notify`, `comment`, `require_review`, or `block_report`
- `enabled`

Example policies:

- Comment when an AI-assisted PR has low attribution confidence.
- Alert when a repo's AI survival drops below its human baseline for two weeks.
- Flag AI PRs with high spend and low survival.

Used for:

- workflow integration
- warnings
- future paid controls

### Digest

A scheduled summary sent to Slack, email, or the app inbox.

Important fields:

- `id`
- `orgId`
- `scope`
- `cadence`
- `recipients`
- `sections`
- `lastSentAt`

Used for:

- weekly team reviews
- exec reporting
- product habit formation

### Report

A generated artifact meant to be shared.

Important fields:

- `id`
- `orgId`
- `title`
- `periodStart`
- `periodEnd`
- `scopes`
- `includedReceipts`
- `narrative`
- `exportFormat`
- `createdByUserId`
- `createdAt`

Used for:

- budget memos
- board updates
- internal AI adoption reviews
- customer-facing benchmark posts, if anonymized

### Audit log

Tracks account and data access events.

Important fields:

- `id`
- `orgId`
- `actorUserId`
- `eventType`
- `targetType`
- `targetId`
- `metadata`
- `createdAt`

Used for:

- security reviews
- enterprise trust
- debugging uploads
- compliance requests

## Aggregations the backend should compute

### Organization rollup

Shows whether AI coding is getting more durable across the company.

Key metrics:

- AI PR count
- human PR count
- AI spend
- survived hunks
- survived hunks per $100
- AI survival score
- human survival score
- AI versus human survival ratio
- cleanup tax
- attribution confidence
- coverage score

### Repository rollup

Shows which repos are absorbing AI well and which repos are creating cleanup.

Key metrics:

- AI PR share
- AI survival score
- human survival score
- cleanup tax
- top risk drivers
- high-spend low-survival PRs
- scan coverage
- excluded paths and exclusions

### Team rollup

Shows whether teams have different AI adoption quality.

Key metrics:

- spend by team
- survival by team
- cleanup tax by team
- human baseline by team
- agent mix
- review drag
- post-merge drag

### User or author rollup

This view is sensitive. It should be framed carefully. The useful question is
not "who is bad?" The useful question is "where do we need coaching or better
agent workflows?"

Key metrics:

- AI-assisted PR count
- average survival score
- human baseline comparison
- review drag
- post-merge drag
- attribution confidence
- most durable examples
- most rewritten examples

### Agent and model rollup

Shows whether a tool is producing durable changes or cheap churn.

Key metrics:

- spend by agent or model
- survived hunks per $100
- average receipt verdict
- cleanup tax
- change classes handled well
- change classes handled poorly

### Change class rollup

Groups work by type.

Example classes:

- tests
- frontend UI
- backend business logic
- migrations
- refactors
- docs
- dependency updates
- generated files

This matters because AI may be excellent for tests and docs while weak for
migrations or core product logic.

## Core use cases

### 1. Connect a repo without giving the app source code

The user creates an org, adds a repo, installs the GitHub Action or runs the
CLI, and receives an upload token.

The UI should show:

- setup commands
- GitHub Action YAML snippet
- what data will be uploaded
- what data will not be uploaded
- the first successful scan run
- coverage warnings

### 2. Backtest six months of history

The user points the CLI at a repo and uploads a historical report.

The UI should show:

- scan progress
- included PRs
- excluded PRs
- AI marker coverage
- human baseline size
- first org-level survival report

This is the fastest path to an "I want this for my repo" moment.

### 3. See AI versus human survival

An engineering leader opens the org dashboard and sees whether AI-assisted PRs
survive better or worse than comparable human PRs.

The UI should show:

- AI survival trend
- human baseline trend
- ratio or gap
- confidence and coverage
- the PRs that explain the movement

The key sentence should be plain:

```text
AI-assisted PRs survived 0.82x as well as human PRs in these repos over the last 30 days.
```

or:

```text
AI-assisted PRs were at parity with human PRs, but cost concentrated in backend refactors.
```

### 4. Inspect a single survival receipt

A staff engineer opens one PR receipt and audits the math.

The UI should show:

- AI markers found
- spend source
- changed files summary
- review drag calculation
- post-merge drag calculation
- hunk survival calculation
- links to GitHub commits and follow-up PRs
- exclusions
- scanner version

This page should be boring in a good way. It should answer "why did you score
this PR that way?"

### 5. Find cleanup leaks

A DevEx lead wants to find places where AI work appears cheap at generation
time but expensive after merge.

The UI should show:

- high cleanup tax PRs
- repos with rising post-merge churn
- agents with high review drag
- defect-linked AI PRs
- hotfix-linked AI PRs

### 6. Compare agents and models

The org wants to know whether Claude Code, Cursor, Copilot, Codex, Devin, or an
internal agent is producing durable output.

The UI should show:

- spend by agent
- survival by agent
- impact density by agent
- change classes each agent handles well
- confidence warning when attribution is weak

The product should avoid claiming that one model is globally better. It should
say where each tool works in this org.

### 7. Prepare a renewal or budget memo

The VP Engineering needs to defend, expand, reduce, or redirect AI spend.

The UI should produce:

- a one-page report
- AI spend by agent
- durable output by repo and team
- human baseline comparison
- three strong examples
- three cleanup examples
- confidence caveats
- recommended next action

### 8. Monitor repo adoption quality over time

After the initial backtest, the GitHub Action keeps sending scan data.

The UI should show:

- weekly survival trend
- repo coverage
- scanner health
- new low-survival receipts
- new durable wins
- regression alerts

### 9. Manage data quality

The buyer will lose trust if the product hides weak evidence. Data quality
deserves its own area in the app.

The UI should show:

- attribution confidence
- scan coverage
- excluded PRs
- PRs too young to score
- missing spend imports
- scanner version drift
- weak marker warnings
- human baseline sample size

### 10. Set policies

Once the report earns trust, users may want lightweight controls.

Example policies:

- Require a receipt comment for AI-assisted PRs above a spend threshold.
- Alert a repo owner when AI survival falls below human baseline.
- Notify DevEx when a new agent appears in co-author trailers.
- Flag high-spend PRs with weak attribution.

Policies should come after reporting. They are not the week-one product, but
the data model should leave room for them.

## Mockup-worthy screens

### Org overview

Purpose:

- answer whether AI-assisted work is surviving across the org

Major components:

- AI versus human survival trend
- spend and impact density cards
- cleanup tax trend
- repo leaderboard
- agent leaderboard
- latest durable receipts
- latest cleanup receipts
- data coverage banner

### Repository page

Purpose:

- show how one repo is handling AI-assisted work

Major components:

- repo survival trend
- human baseline comparison
- PR receipt table
- change class breakdown
- top risk drivers
- scan run history
- repo configuration

### Receipt detail page

Purpose:

- make one score auditable

Major components:

- verdict and score
- PR metadata
- AI attribution evidence
- spend evidence
- review drag math
- post-merge drag math
- survival math
- linked follow-up work
- generated receipt markdown
- scanner version and upload source

### Agent comparison page

Purpose:

- show which agents and models produce durable change in this org

Major components:

- agent spend chart
- impact density chart
- survival by change class
- cleanup tax by agent
- confidence warnings
- example receipts

### Team comparison page

Purpose:

- help leaders compare adoption quality without turning the product into a
  blame tool

Major components:

- team survival scores
- team human baselines
- team spend
- review drag
- post-merge drag
- coaching opportunities
- examples to discuss

### Data quality page

Purpose:

- help skeptical users trust or reject a report

Major components:

- scan coverage
- attribution marker coverage
- human baseline sample size
- excluded PR list
- scanner versions
- missing integrations
- upload errors
- redaction settings

### Report builder

Purpose:

- turn the app's evidence into a shareable artifact

Major components:

- period selector
- scope selector
- included examples
- caveats
- export to PDF, Markdown, or share link
- saved reports

### Settings and security page

Purpose:

- prove that source code does not need to leave the customer's environment

Major components:

- upload sources
- API tokens
- GitHub Action setup
- GitHub App installation status
- repo scopes
- data retention
- redaction mode
- audit log

## Upload payload shape

The CLI and GitHub Action should upload a batch payload shaped like this:

```ts
interface SurvivalUpload {
  schemaVersion: string;
  orgSlug: string;
  source: {
    kind: "cli" | "github_action";
    scannerVersion: string;
    runId: string;
    startedAt: string;
    completedAt: string;
  };
  repo: {
    provider: "github";
    owner: string;
    name: string;
    defaultBranch: string;
    commitSha: string;
  };
  scan: {
    mode: "backtest" | "scheduled" | "pr" | "manual";
    lookbackStart: string;
    lookbackEnd: string;
    survivalWindowDays: number;
    coverage: ScanCoverageInput;
  };
  pullRequests: PullRequestInput[];
  receipts: SurvivalReceiptInput[];
}
```

The backend should treat uploads as append-only. If the same scan run uploads
again, the app can replace that run's records, but it should keep an audit event
for the replacement.

## Security and privacy posture

The design should make the security model visible.

Default posture:

- no source code stored
- no raw diffs stored unless the customer opts in
- file paths can be hashed
- PR titles can be redacted for strict customers
- commit SHAs and PR URLs are stored because they make receipts auditable
- hunk fingerprints are stored to track survival without storing content
- uploads are scoped to an org and repo
- every upload source can be revoked
- every report can show its data retention and redaction mode

Enterprise posture:

- self-hosted runner support
- customer-managed upload token
- optional self-hosted backend
- configurable retention
- audit logs
- SSO and role-based access
- no model calls unless explicitly configured

## Product edges to keep sharp

The web app should not look like another developer productivity dashboard.

It should keep three objects at the center:

1. The receipt.
2. The AI versus human baseline.
3. The evidence quality score.

Those three objects make the product defensible. Without them, it becomes a
dashboard of AI activity, and that is exactly the category we want to avoid.

## Design notes for the mockup

Use receipts as the main visual unit. A receipt should feel like something a
staff engineer could audit and an executive could cite.

Show confidence and coverage near the top of every report. Weak evidence should
be obvious.

Keep charts tied to decisions:

- renew or cut a tool
- coach a team
- investigate a repo
- adjust AI usage policy
- run a better backtest

Avoid gamified individual rankings. User-level views should focus on examples,
coaching, and workflow quality. The fastest way to lose trust is to make this
feel like surveillance with a new metric.

The strongest mockup would show a leader moving from org summary to one
surprising PR receipt, then to an agent comparison, then to a shareable budget
memo. That path tells the whole story.
