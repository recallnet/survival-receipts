Ship a **static backtest report generator** by Friday, June 19, 2026.

Not a platform. Not a GitHub app. Not live monitoring. The MVP is:

```text
Point it at a repo -> get a Survival Receipt report
```

The report should answer:

```text
Did AI-assisted PRs in this repo survive better or worse than human PRs?
```

That comparison is the aha. A raw “AI code survived 72%” is weak. “AI-assisted PRs in this repo died 1.8x faster than human PRs” is a verdict.

**Friday MVP**

Build a CLI that scans one local Git repo and emits a static HTML/Markdown report.

Example:

```bash
pnpm survival scan \
  --repo /path/to/repo \
  --since 2025-12-01 \
  --horizon 30 \
  --out reports/recall-app
```

Report sections:

- AI-assisted PR count
- human baseline PR count
- 30-day survival rate for AI-assisted PRs
- 30-day survival rate for human PRs
- AI vs human survival ratio
- most durable AI-assisted PRs
- fastest-dead AI-assisted PRs
- estimated AI spend, clearly labeled as an estimate
- exact markers used for attribution
- excluded PRs and why
- methodology appendix

This should feel more like a forensic report than a dashboard.

**Freeze The Metric**

Use one deterministic metric all week:

```text
30-day added-line survival
```

Definition:

A PR’s added line survives if, 30 days after merge, `git blame -M -C` still attributes that line to the PR’s merge commit or one of the PR commits.

Rules:

- Added lines are the denominator.
- Surviving blamed lines are the numerator.
- Deletion-only PRs are excluded from survival scoring and listed separately.
- Reverts count as death.
- PRs younger than 30 days are excluded from 30-day scoring.
- Formatting/vendor/lockfile-only PRs are excluded.
- No LLM scoring.

This is imperfect, but auditable. A staff engineer can inspect the math.

**Attribution Scope**

Do not solve attribution this week. Use only obvious deterministic markers.

Freeze a small marker set on Monday:

- PR labels: `ai`, `ai-assisted`, `claude`, `claude-code`, `cursor`, `codex`, `copilot`, `agent-authored`
- commit trailers containing: `claude`, `anthropic`, `codex`, `openai`, `copilot`, `cursor`, `devin`
- known agent/bot authors from a config allowlist
- optional local override file for manually marking PRs

Everything else is human baseline or unknown. Unknowns should be reported, not forced.

**Architecture**

Keep it simple:

- `src/report/scanRepo.ts`: repo discovery, PR collection
- `src/report/classifyPr.ts`: AI/human/unknown classification
- `src/report/survival.ts`: deterministic survival math
- `src/report/renderReport.ts`: Markdown and static HTML output
- `src/report/config.ts`: marker list, exclusions, pricing assumptions
- `src/cli.ts`: command entrypoint

Use Git facts first. Use `gh` CLI if available for PR metadata. Fall back to merge commits and commit trailers if GitHub metadata is unavailable.

**Week Plan**

Monday, June 15:
- Freeze the metric, marker list, and exclusion rules.
- Build CLI skeleton.
- Build synthetic git fixture tests: one AI PR survives, one gets rewritten, one gets reverted.
- Emit a rough Markdown report from fixture data.

Tuesday, June 16:
- Implement real repo scanning.
- Pull PR metadata through `gh`.
- Compute added-line survival with `git blame -M -C`.
- Run on one Recall repo.
- Debug correctness by manually checking 5 PRs.

Wednesday, June 17:
- Render the report as polished static HTML.
- Run on 3 to 5 internal repos.
- Keep a “surprising findings” doc.
- Do a capped prior-art check: GitClear, DX, Jellyfish, SourceCred, provider dashboards. Two hours max.

Thursday, June 18:
- Run on a broader internal set and selected public repos with visible AI markers.
- Publish or prepare one strong public-facing report.
- Add a clear CTA: “send us a repo, we’ll run the survival report.”
- Do not add new metrics unless the original one is broken.

Friday, June 19:
- Demo the best report.
- Review manual audit results.
- Decide continue, narrow, or park.
- The decision should be based on reactions to specific PR findings, not whether the codebase feels complete.

**Pass/Fail Criteria**

Pass if at least two of these happen:

- Internal engineering leaders ask to run it on another repo.
- Staff engineers argue with specific PR evidence rather than dismiss the metric.
- The report finds at least one surprising durable AI PR and one surprising cleanup-heavy AI PR.
- AI vs human survival produces a clear verdict in at least one repo.
- External readers ask for their repo to be scanned.

Fail or pause if:

- Marker coverage is too low to produce meaningful AI cohorts.
- Manual audits show blame-based survival is too misleading.
- The report feels like another activity dashboard.
- Nobody cares which PRs survived.

**Immediately After MVP**

1. GitHub Action that comments a Survival Receipt on merged AI-labeled PRs.
2. Better attribution through Claude/Codex/Cursor local logs.
3. Configurable BYO judge, but only for fuzzy classification, not core scoring.
4. Syntax-aware hunk survival to reduce line-blame noise.
5. Cost import from provider exports or gateway logs.
6. Team rollups and weekly Slack digest.
7. Public benchmark page: AI survival by repo, language, agent, and change type.

The main discipline: keep week one deterministic, report-shaped, and surprising. The product either earns attention as a new way to see AI coding quality, or it doesn’t.
