import { describe, expect, it } from "vitest";
import { renderMarkdownReport } from "./report";
import type { ScanResult, ScannedChange } from "./scanner";

const makeChange = (input: {
  id: string;
  kind: "ai" | "human";
  addedLines: number;
  survivingLines: number;
  survivalDays?: number;
  pendingDays?: number[];
}): ScannedChange => ({
  commit: {
    sha: input.id.padEnd(40, "0"),
    shortSha: input.id,
    parentShas: ["parent"],
    authorName: input.kind === "ai" ? "Agent" : "Human",
    authorEmail: `${input.kind}@example.com`,
    committerName: input.kind === "ai" ? "Agent" : "Human",
    committerEmail: `${input.kind}@example.com`,
    committedAt: "2026-01-01T12:00:00Z",
    subject: `${input.kind} change`,
    message: `${input.kind} change`
  },
  prNumber: null,
  kind: input.kind,
  ai: {
    isAi: input.kind === "ai",
    confidence: input.kind === "ai" ? 1 : 0,
    matches:
      input.kind === "ai"
        ? [{ label: "configured PR #1", source: "config" }]
        : []
  },
  files: [],
  includedFiles: [],
  excludedFiles: [],
  addedLines: input.addedLines,
  deletedLines: 0,
  changedLines: input.addedLines,
  estimatedAiCostUsd: input.kind === "ai" ? 1 : 0,
  checkpoints: [
    {
      survivalDays: input.survivalDays ?? 30,
      survivalDate: "2026-02-01T12:00:00Z",
      targetSha: "target",
      survivingLines: input.survivingLines,
      survivalRatio: input.survivingLines / input.addedLines,
      fileSurvival: [],
      status: "scored",
      skipReason: null
    },
    ...(input.pendingDays ?? []).map((days) => ({
      survivalDays: days,
      survivalDate: "2026-03-01T12:00:00Z",
      targetSha: null,
      survivingLines: 0,
      survivalRatio: null,
      fileSurvival: [],
      status: "pending" as const,
      skipReason: null
    }))
  ],
  status: "scored",
  skipReason: null
});

const makeResult = (
  changes: ScannedChange[],
  survivalDays: number[] = [30]
): ScanResult => ({
  generatedAt: "2026-02-01T12:00:00Z",
  repoInput: ".",
  repoRoot: "/repo",
  repoName: "repo",
  headSha: "headsha",
  asOf: "2026-03-03T12:00:00Z",
  changeWindowStart: "2026-01-01T12:00:00Z",
  changeWindowEnd: "2026-02-01T12:00:00Z",
  sourceMode: "window",
  sourceFromSha: null,
  sourceToSha: null,
  configPath: null,
  configuredAiGithubUsernames: [],
  configuredAiPrNumbers: [],
  survivalDays,
  windowDays: 31,
  limit: 250,
  maxFilesPerChange: 25,
  maxAddedLinesPerChange: 1500,
  maxFileAddedLines: 300,
  blameTimeoutMs: 15000,
  copyDetection: false,
  commitsSeen: changes.length,
  changes
});

describe("survival report", () => {
  it("compares AI and human survival within size buckets", () => {
    const report = renderMarkdownReport(
      makeResult([
        makeChange({
          id: "aiTiny",
          kind: "ai",
          addedLines: 10,
          survivingLines: 8
        }),
        makeChange({
          id: "humanTiny",
          kind: "human",
          addedLines: 10,
          survivingLines: 5
        }),
        makeChange({
          id: "aiMedium",
          kind: "ai",
          addedLines: 250,
          survivingLines: 200
        }),
        makeChange({
          id: "humanMedium",
          kind: "human",
          addedLines: 250,
          survivingLines: 225
        })
      ])
    );

    expect(report).toContain("## Survival by change size");
    expect(report).toContain("## Survival by checkpoint");
    expect(report).toContain(
      "| Tiny, 1-20 lines | 1 | 10 | 8 | 80% | 1 | 10 | 5 | 50% | +30 pts |"
    );
    expect(report).toContain(
      "| Medium, 101-500 lines | 1 | 250 | 200 | 80% | 1 | 250 | 225 | 90% | -10 pts |"
    );
    expect(report).toContain(
      "Overall line-weighted survival: AI added lines died 1.73x as often as human added lines."
    );
    expect(report).toContain(
      "AI and humans split the 2 comparable size buckets."
    );
  });

  it("calls out when the line-weighted result disagrees with size buckets", () => {
    const report = renderMarkdownReport(
      makeResult([
        makeChange({
          id: "aiTiny",
          kind: "ai",
          addedLines: 10,
          survivingLines: 4
        }),
        makeChange({
          id: "humanTiny",
          kind: "human",
          addedLines: 10,
          survivingLines: 9
        }),
        makeChange({
          id: "aiSmall",
          kind: "ai",
          addedLines: 50,
          survivingLines: 25
        }),
        makeChange({
          id: "humanSmall",
          kind: "human",
          addedLines: 50,
          survivingLines: 45
        }),
        makeChange({
          id: "aiMedium",
          kind: "ai",
          addedLines: 250,
          survivingLines: 125
        }),
        makeChange({
          id: "humanMedium",
          kind: "human",
          addedLines: 250,
          survivingLines: 225
        }),
        makeChange({
          id: "aiLarge",
          kind: "ai",
          addedLines: 1000,
          survivingLines: 950
        }),
        makeChange({
          id: "humanLarge",
          kind: "human",
          addedLines: 1000,
          survivingLines: 500
        })
      ])
    );

    expect(report).toContain(
      "Overall line-weighted survival: AI was 1.42x the human baseline."
    );
    expect(report).toContain(
      "Humans led in 3 of 4 comparable size buckets."
    );
  });

  it("shows pending checkpoints without blocking available survival data", () => {
    const report = renderMarkdownReport(
      makeResult(
        [
          makeChange({
            id: "aiYoung",
            kind: "ai",
            addedLines: 10,
            survivingLines: 8,
            survivalDays: 15,
            pendingDays: [30]
          }),
          makeChange({
            id: "humanYoung",
            kind: "human",
            addedLines: 10,
            survivingLines: 7,
            survivalDays: 15,
            pendingDays: [30]
          })
        ],
        [15, 30]
      )
    );

    expect(report).toContain("- Available survival days: 15");
    expect(report).toContain("- Headline survival days: 15");
    expect(report).toContain("| 30 | 0 | 1 | 0 | n/a | 0 | 1 | 0 | n/a | n/a |");
    expect(report).toContain("## Pending checkpoints");
    expect(report).toContain("- 30 days: 2 pending checkpoints");
  });
});
