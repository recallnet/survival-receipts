import { Effect } from "effect";

export const survivalWindows = ["forecast", "day7", "day14", "day30"] as const;

export type SurvivalWindow = (typeof survivalWindows)[number];

export type Verdict = "durable" | "watch" | "sludge";

export const windowLabels: Record<SurvivalWindow, string> = {
  forecast: "Forecast",
  day7: "7d",
  day14: "14d",
  day30: "30d"
};

export interface AiAttribution {
  provider: string;
  model: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  confidence: number;
  source: "declared" | "branch-timing" | "cli-log" | "gateway";
}

export interface ReviewEvidence {
  changedFiles: number;
  linesChanged: number;
  semanticHunks: number;
  reviewComments: number;
  authorRevisionRounds: number;
  reviewerRewritePct: number;
  ciFailures: number;
}

export interface SurvivalEvidence {
  hunkSurvival: number;
  postMergeChurn: number;
  followUpTouchCount: number;
  defectLinks: number;
  hotfixLinks: number;
  revertCount: number;
  confidence: number;
}

export interface PullRequestRecord {
  id: string;
  number: number;
  title: string;
  repo: string;
  team: string;
  author: string;
  agent: string;
  mergedAt: string;
  shippedSurface: string;
  ai: AiAttribution;
  review: ReviewEvidence;
  survival: Record<SurvivalWindow, SurvivalEvidence>;
}

export interface ScoredPullRequest extends PullRequestRecord {
  window: SurvivalWindow;
  evidence: SurvivalEvidence;
  survivalScore: number;
  survivedHunks: number;
  hunksPer100Dollars: number;
  dollarsPerSurvivedHunk: number;
  cleanupTaxUsd: number;
  reviewDrag: number;
  postMergeDrag: number;
  verdict: Verdict;
  riskDrivers: string[];
  receiptMarkdown: string;
}

export interface TeamRollup {
  team: string;
  spendUsd: number;
  survivedHunks: number;
  hunksPer100Dollars: number;
  cleanupTaxUsd: number;
  survivalScore: number;
  pullRequestCount: number;
}

export interface WorkspaceScore {
  window: SurvivalWindow;
  spendUsd: number;
  survivedHunks: number;
  semanticHunks: number;
  hunksPer100Dollars: number;
  dollarsPerSurvivedHunk: number;
  cleanupTaxUsd: number;
  survivalScore: number;
  attributionConfidence: number;
  watchCount: number;
  sludgeCount: number;
  pullRequests: ScoredPullRequest[];
  teams: TeamRollup[];
  cleanupLeaks: ScoredPullRequest[];
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(Math.max(value, min), max);

const round = (value: number, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const sum = <T>(values: T[], select: (value: T) => number) =>
  values.reduce((total, value) => total + select(value), 0);

const weightedAverage = <T>(
  values: T[],
  valueOf: (value: T) => number,
  weightOf: (value: T) => number
) => {
  const totalWeight = sum(values, weightOf);

  if (totalWeight === 0) {
    return 0;
  }

  return sum(values, (value) => valueOf(value) * weightOf(value)) / totalWeight;
};

const verdictFor = (score: number): Verdict => {
  if (score >= 74) {
    return "durable";
  }

  if (score >= 52) {
    return "watch";
  }

  return "sludge";
};

const sourceLabel: Record<AiAttribution["source"], string> = {
  declared: "declared PR tag",
  "branch-timing": "branch timing",
  "cli-log": "local CLI log",
  gateway: "gateway trace"
};

const riskDriversFor = (
  pr: PullRequestRecord,
  evidence: SurvivalEvidence,
  reviewDrag: number,
  postMergeDrag: number
) => {
  const drivers: string[] = [];
  const commentsPerHunk =
    pr.review.reviewComments / Math.max(pr.review.semanticHunks, 1);

  if (commentsPerHunk > 1.25) {
    drivers.push("dense review thread");
  }

  if (pr.review.reviewerRewritePct > 0.35) {
    drivers.push("large reviewer rewrite");
  }

  if (pr.review.ciFailures >= 3) {
    drivers.push("repeated CI rejection");
  }

  if (evidence.postMergeChurn > 0.28) {
    drivers.push("post-merge churn");
  }

  if (evidence.followUpTouchCount >= 6) {
    drivers.push("many follow-up edits");
  }

  if (evidence.defectLinks > 0) {
    drivers.push("linked defect");
  }

  if (evidence.hotfixLinks > 0) {
    drivers.push("linked hotfix");
  }

  if (evidence.revertCount > 0) {
    drivers.push("revert pressure");
  }

  if (pr.ai.confidence < 0.62 || evidence.confidence < 0.62) {
    drivers.push("weak attribution");
  }

  if (reviewDrag > 0.38 && postMergeDrag > 0.3) {
    drivers.push("cleanup shifted after merge");
  }

  return drivers.length > 0 ? drivers : ["no pressure signals"];
};

const makeReceipt = (pr: ScoredPullRequest) => {
  const lines = [
    `### AI change survival receipt for #${pr.number}`,
    "",
    `**Verdict:** ${pr.verdict} (${pr.survivalScore}/100)`,
    `**AI spend:** $${round(pr.ai.costUsd, 2).toFixed(2)} from ${pr.ai.sessions} ${pr.agent} sessions`,
    `**Durable output:** ${round(pr.survivedHunks, 1)} survived semantic hunks`,
    `**Impact density:** ${round(pr.hunksPer100Dollars, 1)} survived hunks per $100`,
    `**Cleanup tax:** $${round(pr.cleanupTaxUsd, 2).toFixed(2)} estimated review and post-merge drag`,
    `**Evidence:** ${Math.round(pr.evidence.hunkSurvival * 100)}% hunk survival, ${Math.round(pr.evidence.postMergeChurn * 100)}% post-merge churn`,
    `**Attribution:** ${sourceLabel[pr.ai.source]}, ${Math.round(pr.ai.confidence * 100)}% confidence`,
    "",
    `Pressure signals: ${pr.riskDrivers.join(", ")}.`
  ];

  return lines.join("\n");
};

export const scorePullRequest = (
  pr: PullRequestRecord,
  window: SurvivalWindow
): ScoredPullRequest => {
  const evidence = pr.survival[window];
  const commentsPerHunk =
    pr.review.reviewComments / Math.max(pr.review.semanticHunks, 1);
  const reviewDrag = clamp(
    commentsPerHunk * 0.045 +
      pr.review.authorRevisionRounds * 0.045 +
      pr.review.reviewerRewritePct * 0.32 +
      pr.review.ciFailures * 0.035,
    0,
    0.62
  );
  const postMergeDrag = clamp(
    evidence.postMergeChurn * 0.42 +
      evidence.followUpTouchCount * 0.035 +
      evidence.defectLinks * 0.13 +
      evidence.hotfixLinks * 0.19 +
      evidence.revertCount * 0.42,
    0,
    0.85
  );
  const survivalRatio = clamp(
    evidence.hunkSurvival * (1 - reviewDrag) * (1 - postMergeDrag)
  );
  const survivedHunks = round(pr.review.semanticHunks * survivalRatio, 1);
  const survivalScore = Math.round(survivalRatio * 100);
  const hunksPer100Dollars = round(
    pr.ai.costUsd > 0 ? (survivedHunks / pr.ai.costUsd) * 100 : 0,
    1
  );
  const dollarsPerSurvivedHunk = round(
    survivedHunks > 0 ? pr.ai.costUsd / survivedHunks : pr.ai.costUsd,
    2
  );
  const cleanupTaxUsd = round(pr.ai.costUsd * (1 - survivalRatio), 2);
  const verdict = verdictFor(survivalScore);
  const riskDrivers = riskDriversFor(pr, evidence, reviewDrag, postMergeDrag);
  const scored: ScoredPullRequest = {
    ...pr,
    window,
    evidence,
    survivalScore,
    survivedHunks,
    hunksPer100Dollars,
    dollarsPerSurvivedHunk,
    cleanupTaxUsd,
    reviewDrag,
    postMergeDrag,
    verdict,
    riskDrivers,
    receiptMarkdown: ""
  };

  return {
    ...scored,
    receiptMarkdown: makeReceipt(scored)
  };
};

const scoreTeams = (pullRequests: ScoredPullRequest[]): TeamRollup[] => {
  const byTeam = pullRequests.reduce<Record<string, ScoredPullRequest[]>>(
    (groups, pr) => {
      groups[pr.team] = groups[pr.team] ?? [];
      groups[pr.team].push(pr);
      return groups;
    },
    {}
  );

  return Object.entries(byTeam)
    .map(([team, prs]) => {
      const spendUsd = sum(prs, (pr) => pr.ai.costUsd);
      const survivedHunks = sum(prs, (pr) => pr.survivedHunks);

      return {
        team,
        spendUsd: round(spendUsd, 2),
        survivedHunks: round(survivedHunks, 1),
        hunksPer100Dollars: round(
          spendUsd > 0 ? (survivedHunks / spendUsd) * 100 : 0,
          1
        ),
        cleanupTaxUsd: round(sum(prs, (pr) => pr.cleanupTaxUsd), 2),
        survivalScore: Math.round(
          weightedAverage(
            prs,
            (pr) => pr.survivalScore,
            (pr) => pr.review.semanticHunks
          )
        ),
        pullRequestCount: prs.length
      };
    })
    .sort((a, b) => b.hunksPer100Dollars - a.hunksPer100Dollars);
};

export const scoreWorkspace = (
  records: PullRequestRecord[],
  window: SurvivalWindow
): Effect.Effect<WorkspaceScore> =>
  Effect.sync(() => {
    const pullRequests = records
      .map((pr) => scorePullRequest(pr, window))
      .sort((a, b) => b.hunksPer100Dollars - a.hunksPer100Dollars);
    const spendUsd = sum(pullRequests, (pr) => pr.ai.costUsd);
    const survivedHunks = sum(pullRequests, (pr) => pr.survivedHunks);
    const semanticHunks = sum(pullRequests, (pr) => pr.review.semanticHunks);
    const cleanupTaxUsd = sum(pullRequests, (pr) => pr.cleanupTaxUsd);

    return {
      window,
      spendUsd: round(spendUsd, 2),
      survivedHunks: round(survivedHunks, 1),
      semanticHunks,
      hunksPer100Dollars: round(
        spendUsd > 0 ? (survivedHunks / spendUsd) * 100 : 0,
        1
      ),
      dollarsPerSurvivedHunk: round(
        survivedHunks > 0 ? spendUsd / survivedHunks : spendUsd,
        2
      ),
      cleanupTaxUsd: round(cleanupTaxUsd, 2),
      survivalScore: Math.round(
        weightedAverage(
          pullRequests,
          (pr) => pr.survivalScore,
          (pr) => pr.review.semanticHunks
        )
      ),
      attributionConfidence: round(
        weightedAverage(
          pullRequests,
          (pr) => (pr.ai.confidence + pr.evidence.confidence) / 2,
          (pr) => pr.ai.costUsd
        ),
        2
      ),
      watchCount: pullRequests.filter((pr) => pr.verdict === "watch").length,
      sludgeCount: pullRequests.filter((pr) => pr.verdict === "sludge").length,
      pullRequests,
      teams: scoreTeams(pullRequests),
      cleanupLeaks: [...pullRequests]
        .sort((a, b) => b.cleanupTaxUsd - a.cleanupTaxUsd)
        .slice(0, 3)
    };
  });
