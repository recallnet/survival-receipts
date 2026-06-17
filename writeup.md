### Idea name

Survival Receipts

Lack of ROI Tracking—Users don't know if they are actually getting value out of their $200+/month personal spend.

### My version of the customer

This is for engineering leaders at AI-heavy software companies who are spending real money on coding agents and starting to worry that "more AI output" is not the same as better engineering throughput.

The first target user is a Head of Engineering, VP Engineering, Director of Engineering, or DevEx / Engineering Productivity lead at a 20 to 300 person engineering org. Their team uses Claude Code, Cursor, Codex, Copilot, or internal agents heavily enough that AI spend is now visible in the budget and visible in the review queue.

The person is usually not anti-AI. They want to keep investing, but they need a way to separate durable shipped work from slop, fragile diffs, and code that gets rewritten two weeks later.

### The forcing moment

They feel the problem when AI usage stops being an experiment and becomes a line item, a management question, or a review burden.

The sharpest forcing moment is a budget or planning meeting where the engineering leader has to decide whether to expand, renew, constrain, or standardize AI coding tools. The spend has gone from "a few people trying Cursor or Claude Code" to "this is costing hundreds or thousands per engineer per month," and the CFO, CTO, or founder asks: is this actually working?

### The pain

What hurts is that AI looks productive in the moment but becomes hard to defend after the fact.

Senior engineers end up spending scarce attention cleaning up AI-assisted work: asking for rewrites, catching subtle bugs, rerunning CI, untangling oversized diffs, or revisiting code that shipped too quickly. The cost does not show up on the AI vendor invoice. It shows up as slower reviews, noisier PRs, defects, hotfixes, and lost trust.

The confusing part is attribution. Spend lives in provider dashboards and expense reports. Outcomes live in GitHub, Linear, Jira, CI, and incident tools. Nobody has one place that says, "this AI spend touched these PRs, and this is what survived."

### The current workaround

Today they stitch together a partial answer from tools that were not built for this question.

For spend, they look at provider dashboards, invoices, and usage exports from OpenAI, Anthropic, Cursor, GitHub Copilot, or whatever gateway/observability layer they use. If they are more advanced, they may use Langfuse, etc, or a homegrown proxy to track tokens, model usage, and cost by user or project.

For engineering outcomes, they look at GitHub, Linear, CI, incident tools, and engineering productivity products like DX, Jellyfish, or Faros. Those tools can show cycle time, PR volume, review load, deployment frequency, defects, and sometimes developer sentiment.

The link in between is unclear and relies on only human judgment.


### Why the workaround fails

The current workaround fails because the link between spend and outcome is assembled by hand, after the fact, and at the wrong level of detail.

Usage dashboards can say who spent money and which model they used. Engineering dashboards can say what happened to PRs, builds, reviews, and defects. But neither side can say: this AI-assisted change cost this much, created this much review drag, and survived or failed after merge.

Once engineers suspect AI metrics are measuring activity instead of durable output, they stop taking the ROI story seriously. The company either keeps spending on faith or cuts back without knowing where AI was actually working.


### The crux

The real problem is not that companies lack AI usage data. It is that usage data became available before anyone agreed on the unit of AI value.

The right unit for AI coding ROI is not time saved. It is durable shipped change.

This became urgent because coding agents changed the cost shape of software work. Before agents, the expensive part was often writing the first draft. Now the first draft can be cheap and fast, while the hidden cost moves into review, CI, debugging, rewrites, and maintenance. The old productivity system still assumes output is scarce. In AI-heavy teams, trustworthy output is scarce.

The wedge is not better cost tracking. Providers and gateways will keep improving that. The wedge is proving which AI-assisted changes survived the engineering system after the tokens were spent.
