import { aiMarkerLabels } from "./markers";
import type { ScanResult, ScannedChange } from "./scanner";

interface ChangeGroupSummary {
  kind: "ai" | "human";
  changes: ScannedChange[];
  scored: ScannedChange[];
  addedLines: number;
  survivingLines: number;
  survivalRatio: number | null;
  estimatedCostUsd: number;
}

const round = (value: number, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const sum = <T>(values: T[], select: (value: T) => number) =>
  values.reduce((total, value) => total + select(value), 0);

const pct = (value: number | null) =>
  value === null ? "n/a" : `${round(value * 100, 1)}%`;

const money = (value: number) => `$${round(value, 2).toFixed(2)}`;

const escapeCell = (value: string) => value.replaceAll("|", "\\|");

const changeUrlLabel = (change: ScannedChange) =>
  change.prNumber ? `#${change.prNumber}` : change.commit.shortSha;

const markerText = (change: ScannedChange) =>
  change.ai.matches.length > 0
    ? change.ai.matches.map((match) => match.label).join(", ")
    : "none";

const summarize = (
  result: ScanResult,
  kind: "ai" | "human"
): ChangeGroupSummary => {
  const changes = result.changes.filter((change) => change.kind === kind);
  const scored = changes.filter((change) => change.status === "scored");
  const addedLines = sum(scored, (change) => change.addedLines);
  const survivingLines = sum(scored, (change) => change.survivingLines);

  return {
    kind,
    changes,
    scored,
    addedLines,
    survivingLines,
    survivalRatio: addedLines > 0 ? survivingLines / addedLines : null,
    estimatedCostUsd: sum(scored, (change) => change.estimatedAiCostUsd)
  };
};

const renderChangeTable = (changes: ScannedChange[]) => {
  if (changes.length === 0) {
    return "No changes in this section.\n";
  }

  const rows = changes.map((change) => [
    changeUrlLabel(change),
    change.commit.shortSha,
    new Date(change.commit.committedAt).toISOString().slice(0, 10),
    escapeCell(change.commit.authorName),
    String(change.addedLines),
    String(change.survivingLines),
    pct(change.survivalRatio),
    change.kind === "ai" ? money(change.estimatedAiCostUsd) : "",
    escapeCell(change.commit.subject)
  ]);

  return [
    "| Change | Commit | Date | Author | Added | Survived | Survival | Est. AI cost | Subject |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n");
};

const renderSkipped = (result: ScanResult) => {
  const skipped = result.changes.filter((change) => change.status === "skipped");
  const counts = skipped.reduce<Record<string, number>>((groups, change) => {
    const key = change.skipReason ?? "unknown";
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});

  if (Object.keys(counts).length === 0) {
    return "- No skipped changes.\n";
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `- ${reason}: ${count}`)
    .join("\n");
};

const renderVerdict = (ai: ChangeGroupSummary, human: ChangeGroupSummary) => {
  if (ai.survivalRatio === null) {
    return "No deterministic AI-authored changes were scored in this scan.";
  }

  if (human.survivalRatio === null) {
    return "AI-authored changes were scored, but there is no human baseline in this scan window.";
  }

  if (human.survivalRatio === 0) {
    return "AI-authored changes survived, but the human baseline has zero surviving added lines in this scan window.";
  }

  const ratio = ai.survivalRatio / human.survivalRatio;

  if (ratio >= 1) {
    return `AI added-line survival is ${round(ratio, 2)}x the human baseline in this repo window.`;
  }

  const deathRatio =
    (1 - ai.survivalRatio) / Math.max(1 - human.survivalRatio, 0.0001);

  return `AI added lines died ${round(deathRatio, 2)}x as often as human added lines in this repo window.`;
};

export const renderMarkdownReport = (result: ScanResult) => {
  const ai = summarize(result, "ai");
  const human = summarize(result, "human");
  const scored = result.changes.filter((change) => change.status === "scored");
  const scoredAi = ai.scored;
  const durableAi = [...scoredAi]
    .sort((a, b) => (b.survivalRatio ?? 0) - (a.survivalRatio ?? 0))
    .slice(0, 8);
  const weakAi = [...scoredAi]
    .sort((a, b) => (a.survivalRatio ?? 0) - (b.survivalRatio ?? 0))
    .slice(0, 8);
  const costPerSurvivingAiLine =
    ai.survivingLines > 0 ? ai.estimatedCostUsd / ai.survivingLines : null;

  return [
    `# Survival receipt report: ${result.repoName}`,
    "",
    `Generated at: ${result.generatedAt}`,
    "",
    "## Verdict",
    "",
    renderVerdict(ai, human),
    "",
    "## Scan settings",
    "",
    `- Repo: ${result.repoRoot}`,
    `- HEAD: ${result.headSha.slice(0, 12)}`,
    `- Since: ${result.since}`,
    `- Until: ${result.until ?? "HEAD"}`,
    `- Config: ${result.configPath ?? "none"}`,
    `- Configured AI GitHub usernames: ${result.configuredAiGithubUsernames.length}`,
    `- Configured AI PR numbers: ${result.configuredAiPrNumbers.length}`,
    `- Horizon: ${result.horizonDays} days`,
    `- Commit limit: ${result.limit}`,
    `- Max files per change: ${result.maxFilesPerChange}`,
    `- Max added lines per change: ${result.maxAddedLinesPerChange}`,
    `- Max added lines per file: ${result.maxFileAddedLines}`,
    `- Blame timeout: ${result.blameTimeoutMs}ms`,
    `- Blame copy detection: ${result.copyDetection ? "on" : "off"}`,
    `- Commits seen: ${result.commitsSeen}`,
    `- Scored changes: ${scored.length}`,
    "",
    "## AI versus human survival",
    "",
    "| Group | Changes | Scored | Added lines | Surviving lines | Survival | Est. AI cost | Cost per surviving AI line |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| AI | ${ai.changes.length} | ${ai.scored.length} | ${ai.addedLines} | ${ai.survivingLines} | ${pct(ai.survivalRatio)} | ${money(ai.estimatedCostUsd)} | ${
      costPerSurvivingAiLine === null ? "n/a" : money(costPerSurvivingAiLine)
    } |`,
    `| Human | ${human.changes.length} | ${human.scored.length} | ${human.addedLines} | ${human.survivingLines} | ${pct(human.survivalRatio)} |  |  |`,
    "",
    "## Most durable AI changes",
    "",
    renderChangeTable(durableAi),
    "## Weakest AI changes",
    "",
    renderChangeTable(weakAi),
    "## Deterministic AI markers",
    "",
    ...aiMarkerLabels.map((label) => `- ${label}`),
    "",
    "## AI marker evidence by change",
    "",
    scoredAi.length === 0
      ? "No AI marker evidence was found."
      : scoredAi
          .map(
            (change) =>
              `- ${changeUrlLabel(change)} ${change.commit.shortSha}: ${markerText(
                change
              )}`
          )
          .join("\n"),
    "",
    "## Skipped changes",
    "",
    renderSkipped(result),
    "",
    "## Method",
    "",
    [
      "This report uses local git facts only.",
      "A scored change must be a single-parent commit with at least one included added line.",
      `For each scored change, the scanner finds the commit at the ${result.horizonDays} day horizon and runs git blame with move detection${
        result.copyDetection ? " and copy detection" : ""
      }.`,
      "A line survives when the horizon blame still attributes it to the source commit.",
      "Generated files, lockfiles, build output, vendored code, sourcemaps, snapshots, binary assets, and media files are excluded.",
      "Merge commits are skipped for now because proper support needs branch reconstruction.",
      "Renamed files may be undercounted in this first scanner because the blame check uses the original path.",
      "Estimated AI cost is a placeholder based on changed lines and file count. Replace it with provider logs or CLI traces when available."
    ].join("\n\n"),
    ""
  ].join("\n");
};
