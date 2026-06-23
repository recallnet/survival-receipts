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

interface BucketGroupSummary {
  changes: number;
  addedLines: number;
  survivingLines: number;
  survivalRatio: number | null;
}

interface BucketComparison {
  bucket: SizeBucket;
  ai: BucketGroupSummary;
  human: BucketGroupSummary;
}

interface SizeBucket {
  id: "tiny" | "small" | "medium" | "large";
  label: string;
  min: number;
  max: number | null;
}

const sizeBuckets: SizeBucket[] = [
  { id: "tiny", label: "Tiny, 1-20 lines", min: 1, max: 20 },
  { id: "small", label: "Small, 21-100 lines", min: 21, max: 100 },
  { id: "medium", label: "Medium, 101-500 lines", min: 101, max: 500 },
  { id: "large", label: "Large, 501+ lines", min: 501, max: null }
];

const round = (value: number, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const sum = <T>(values: T[], select: (value: T) => number) =>
  values.reduce((total, value) => total + select(value), 0);

const pct = (value: number | null) =>
  value === null ? "n/a" : `${round(value * 100, 1)}%`;

const pointDelta = (aiRatio: number | null, humanRatio: number | null) => {
  if (aiRatio === null || humanRatio === null) {
    return "n/a";
  }

  const delta = round((aiRatio - humanRatio) * 100, 1);

  return `${delta >= 0 ? "+" : ""}${delta} pts`;
};

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

const bucketFor = (change: ScannedChange) =>
  sizeBuckets.find(
    (bucket) =>
      change.addedLines >= bucket.min &&
      (bucket.max === null || change.addedLines <= bucket.max)
  );

const summarizeBucket = (
  changes: ScannedChange[],
  kind: "ai" | "human",
  bucket: SizeBucket
): BucketGroupSummary => {
  const bucketChanges = changes.filter(
    (change) => change.kind === kind && bucketFor(change)?.id === bucket.id
  );
  const addedLines = sum(bucketChanges, (change) => change.addedLines);
  const survivingLines = sum(bucketChanges, (change) => change.survivingLines);

  return {
    changes: bucketChanges.length,
    addedLines,
    survivingLines,
    survivalRatio: addedLines > 0 ? survivingLines / addedLines : null
  };
};

const compareSizeBuckets = (result: ScanResult): BucketComparison[] => {
  const scored = result.changes.filter((change) => change.status === "scored");

  return sizeBuckets.map((bucket) => ({
    bucket,
    ai: summarizeBucket(scored, "ai", bucket),
    human: summarizeBucket(scored, "human", bucket)
  }));
};

const renderSizeBucketTable = (comparisons: BucketComparison[]) => {
  const rows = comparisons.map(({ bucket, ai, human }) => {
    return [
      bucket.label,
      String(ai.changes),
      String(ai.addedLines),
      String(ai.survivingLines),
      pct(ai.survivalRatio),
      String(human.changes),
      String(human.addedLines),
      String(human.survivingLines),
      pct(human.survivalRatio),
      pointDelta(ai.survivalRatio, human.survivalRatio)
    ];
  });

  return [
    "| Bucket | AI changes | AI added | AI survived | AI survival | Human changes | Human added | Human survived | Human survival | AI minus human |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n");
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

const bucketLeaderSummary = (comparisons: BucketComparison[]) => {
  const comparable = comparisons.filter(
    (comparison) =>
      comparison.ai.survivalRatio !== null &&
      comparison.human.survivalRatio !== null
  );

  if (comparable.length === 0) {
    return "No size bucket had both AI and human scored changes.";
  }

  const aiWins = comparable.filter(
    (comparison) => comparison.ai.survivalRatio! > comparison.human.survivalRatio!
  ).length;
  const humanWins = comparable.filter(
    (comparison) => comparison.human.survivalRatio! > comparison.ai.survivalRatio!
  ).length;
  const ties = comparable.length - aiWins - humanWins;
  const tieText = ties > 0 ? `, with ${ties} tied` : "";

  if (aiWins > humanWins) {
    return `AI led in ${aiWins} of ${comparable.length} comparable size buckets${tieText}.`;
  }

  if (humanWins > aiWins) {
    return `Humans led in ${humanWins} of ${comparable.length} comparable size buckets${tieText}.`;
  }

  return `AI and humans split the ${comparable.length} comparable size buckets${tieText}.`;
};

const renderVerdict = (
  ai: ChangeGroupSummary,
  human: ChangeGroupSummary,
  bucketComparisons: BucketComparison[]
) => {
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
  const lineWeighted =
    ratio >= 1
      ? `Overall line-weighted survival: AI was ${round(ratio, 2)}x the human baseline.`
      : `Overall line-weighted survival: AI added lines died ${round(
          (1 - ai.survivalRatio) / Math.max(1 - human.survivalRatio, 0.0001),
          2
        )}x as often as human added lines.`;
  const bucketSummary = bucketLeaderSummary(bucketComparisons);

  return `${lineWeighted} ${bucketSummary}`;
};

export const renderMarkdownReport = (result: ScanResult) => {
  const ai = summarize(result, "ai");
  const human = summarize(result, "human");
  const bucketComparisons = compareSizeBuckets(result);
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
    renderVerdict(ai, human, bucketComparisons),
    "",
    "## Scan settings",
    "",
    `- Repo: ${result.repoRoot}`,
    `- HEAD: ${result.headSha.slice(0, 12)}`,
    `- As of: ${result.asOf}`,
    `- Survival days: ${result.survivalDays}`,
    `- Window days: ${result.windowDays}`,
    `- Mature change window: ${result.changeWindowStart} to ${result.changeWindowEnd}`,
    `- Config: ${result.configPath ?? "none"}`,
    `- Configured AI GitHub usernames: ${result.configuredAiGithubUsernames.length}`,
    `- Configured AI PR numbers: ${result.configuredAiPrNumbers.length}`,
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
    "## Survival by change size",
    "",
    renderSizeBucketTable(bucketComparisons),
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
      `For each scored change, the scanner finds the commit at the ${result.survivalDays} day survival date and runs git blame with move detection${
        result.copyDetection ? " and copy detection" : ""
      }.`,
      "A line survives when the survival-date blame still attributes it to the source commit.",
      "The mature change window ends survival-days before the report cutoff, so every scored change has had a full survival period.",
      "Size buckets compare AI and human changes with similar added-line counts: tiny is 1-20 lines, small is 21-100, medium is 101-500, and large is 501 or more.",
      "Generated files, lockfiles, build output, vendored code, sourcemaps, snapshots, binary assets, and media files are excluded.",
      "Merge commits are skipped for now because proper support needs branch reconstruction.",
      "Renamed files may be undercounted in this first scanner because the blame check uses the original path.",
      "Estimated AI cost is a placeholder based on changed lines and file count. Replace it with provider logs or CLI traces when available."
    ].join("\n\n"),
    ""
  ].join("\n");
};
