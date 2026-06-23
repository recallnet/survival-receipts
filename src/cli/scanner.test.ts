import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { emptyAiOverrideConfig } from "./config";
import { detectAiAttribution, githubUsernamesForIdentity } from "./markers";
import { renderMarkdownReport } from "./report";
import { extractPrNumber, scanRepository } from "./scanner";

const execFileAsync = promisify(execFile);

const git = async (
  repo: string,
  args: string[],
  env: NodeJS.ProcessEnv = {}
) => {
  await execFileAsync("git", ["-C", repo, ...args], {
    env: { ...process.env, ...env },
    maxBuffer: 1024 * 1024 * 16
  });
};

const commitAll = async (repo: string, message: string[], date: string) => {
  await git(repo, ["add", "."]);
  await git(repo, ["commit", ...message.flatMap((part) => ["-m", part])], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date
  });
};

describe("CLI scanner", () => {
  it("detects deterministic AI markers", () => {
    const detection = detectAiAttribution({
      message:
        "ship helper\n\nCo-authored-by: Claude <noreply@anthropic.com>",
      authorName: "Aaron",
      authorEmail: "aaron@example.com",
      committerName: "Aaron",
      committerEmail: "aaron@example.com",
      prNumber: null,
      overrides: emptyAiOverrideConfig
    });

    expect(detection.isAi).toBe(true);
    expect(detection.confidence).toBeGreaterThan(0.8);
    expect(detection.matches[0]?.source).toBe("message");
  });

  it("treats configured PR numbers as AI with total confidence", () => {
    const detection = detectAiAttribution({
      message: "plain human-looking message",
      authorName: "Aaron",
      authorEmail: "aaron@example.com",
      committerName: "Aaron",
      committerEmail: "aaron@example.com",
      prNumber: 123,
      overrides: {
        githubUsernames: [],
        prNumbers: [123]
      }
    });

    expect(detection.isAi).toBe(true);
    expect(detection.confidence).toBe(1);
    expect(detection.matches).toContainEqual({
      label: "configured PR #123",
      source: "config"
    });
  });

  it("extracts GitHub usernames from noreply identities", () => {
    expect(
      githubUsernamesForIdentity({
        name: "Display Name",
        email: "12345+cto-new[bot]@users.noreply.github.com"
      })
    ).toContain("cto-new[bot]");
  });

  it("treats configured GitHub usernames as AI with total confidence", () => {
    const detection = detectAiAttribution({
      message: "plain human-looking message",
      authorName: "Display Name",
      authorEmail: "12345+cto-new[bot]@users.noreply.github.com",
      committerName: "Display Name",
      committerEmail: "display@example.com",
      prNumber: null,
      overrides: {
        githubUsernames: ["cto-new[bot]"],
        prNumbers: []
      }
    });

    expect(detection.isAi).toBe(true);
    expect(detection.confidence).toBe(1);
    expect(detection.matches).toContainEqual({
      label: "configured GitHub username cto-new[bot]",
      source: "config"
    });
  });

  it("extracts PR numbers from common squash and merge subjects", () => {
    expect(extractPrNumber("Add checkout retry (#1849)")).toBe(1849);
    expect(extractPrNumber("Merge pull request #22 from recall/agent")).toBe(22);
    expect(extractPrNumber("plain commit")).toBeNull();
  });

  it("scans a local repo and compares AI survival to human survival", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "survival-scan-"));

    try {
      await execFileAsync("git", ["init", repo]);
      await git(repo, ["config", "user.name", "Test User"]);
      await git(repo, ["config", "user.email", "test@example.com"]);

      await fs.writeFile(path.join(repo, "app.ts"), "base\n");
      await commitAll(repo, ["initial"], "2026-01-01T12:00:00Z");

      await fs.writeFile(
        path.join(repo, "app.ts"),
        "base\nai survives\nai dies\n"
      );
      await commitAll(
        repo,
        [
          "ship agent helper (#12)",
          "Co-authored-by: Claude <noreply@anthropic.com>"
        ],
        "2026-01-02T12:00:00Z"
      );

      await fs.writeFile(
        path.join(repo, "app.ts"),
        "base\nai survives\nai dies\nhuman survives\n"
      );
      await commitAll(repo, ["ship human helper (#13)"], "2026-01-03T12:00:00Z");

      await fs.writeFile(
        path.join(repo, "app.ts"),
        "base\nai survives\nhuman survives\n"
      );
      await commitAll(repo, ["remove bad AI line"], "2026-01-20T12:00:00Z");

      const result = await Effect.runPromise(
        scanRepository({
          repo,
          asOf: "2026-02-03T12:00:00Z",
          configPath: null,
          survivalDays: [30],
          windowDays: 30,
          limit: 25,
          maxFilesPerChange: 40,
          maxAddedLinesPerChange: 2500,
          maxFileAddedLines: 750,
          blameTimeoutMs: 30000,
          copyDetection: false
        })
      );
      const aiChange = result.changes.find(
        (change) => change.commit.subject === "ship agent helper (#12)"
      );
      const humanChange = result.changes.find(
        (change) => change.commit.subject === "ship human helper (#13)"
      );
      const report = renderMarkdownReport(result);

      expect(aiChange?.kind).toBe("ai");
      expect(aiChange?.status).toBe("scored");
      expect(aiChange?.prNumber).toBe(12);
      expect(aiChange?.addedLines).toBe(2);
      expect(aiChange?.checkpoints[0]?.survivingLines).toBe(1);
      expect(aiChange?.checkpoints[0]?.survivalRatio).toBe(0.5);

      expect(humanChange?.kind).toBe("human");
      expect(humanChange?.status).toBe("scored");
      expect(humanChange?.checkpoints[0]?.survivalRatio).toBe(1);
      expect(report).toContain("AI added lines died");
      expect(report).toContain("ship agent helper");
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("selects the mature source window from as-of, survival days, and window days", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "survival-window-"));

    try {
      await execFileAsync("git", ["init", repo]);
      await git(repo, ["config", "user.name", "Test User"]);
      await git(repo, ["config", "user.email", "test@example.com"]);

      await fs.writeFile(path.join(repo, "app.ts"), "base\n");
      await commitAll(repo, ["initial"], "2026-01-01T12:00:00Z");

      await fs.writeFile(path.join(repo, "app.ts"), "base\nfirst\n");
      await commitAll(repo, ["first change (#1)"], "2026-01-02T12:00:00Z");

      await fs.writeFile(path.join(repo, "app.ts"), "base\nfirst\nsecond\n");
      await commitAll(repo, ["second change (#2)"], "2026-02-02T12:00:00Z");

      const result = await Effect.runPromise(
        scanRepository({
          repo,
          asOf: "2026-02-03T12:00:00Z",
          configPath: null,
          survivalDays: [30],
          windowDays: 30,
          limit: 25,
          maxFilesPerChange: 40,
          maxAddedLinesPerChange: 2500,
          maxFileAddedLines: 750,
          blameTimeoutMs: 30000,
          copyDetection: false
        })
      );

      expect(result.asOf).toBe("2026-02-03T12:00:00.000Z");
      expect(result.changeWindowStart).toBe("2025-12-05T12:00:00.000Z");
      expect(result.changeWindowEnd).toBe("2026-01-04T12:00:00.000Z");
      expect(result.changes.map((change) => change.commit.subject)).toEqual([
        "first change (#1)",
        "initial"
      ]);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("loads survival.config.json from the scanned repo", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "survival-config-"));

    try {
      await execFileAsync("git", ["init", repo]);
      await git(repo, ["config", "user.name", "Test User"]);
      await git(repo, ["config", "user.email", "test@example.com"]);

      await fs.writeFile(
        path.join(repo, "survival.config.json"),
        JSON.stringify({ ai: { prNumbers: [44], githubUsernames: [] } }, null, 2)
      );
      await fs.writeFile(path.join(repo, "app.ts"), "base\n");
      await commitAll(repo, ["initial"], "2026-01-01T12:00:00Z");

      await fs.writeFile(path.join(repo, "app.ts"), "base\nconfigured\n");
      await commitAll(repo, ["configured change (#44)"], "2026-01-02T12:00:00Z");

      const result = await Effect.runPromise(
        scanRepository({
          repo,
          asOf: "2026-01-04T12:00:00Z",
          configPath: null,
          survivalDays: [1],
          windowDays: 1,
          limit: 25,
          maxFilesPerChange: 40,
          maxAddedLinesPerChange: 2500,
          maxFileAddedLines: 750,
          blameTimeoutMs: 30000,
          copyDetection: false
        })
      );
      const configuredChange = result.changes.find(
        (change) => change.prNumber === 44
      );

      expect(result.configPath?.endsWith("survival.config.json")).toBe(true);
      expect(result.configuredAiPrNumbers).toEqual([44]);
      expect(configuredChange?.kind).toBe("ai");
      expect(configuredChange?.ai.confidence).toBe(1);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("scores one change at multiple survival checkpoints", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "survival-curve-"));

    try {
      await execFileAsync("git", ["init", repo]);
      await git(repo, ["config", "user.name", "Test User"]);
      await git(repo, ["config", "user.email", "test@example.com"]);

      await fs.writeFile(path.join(repo, "app.ts"), "base\n");
      await commitAll(repo, ["initial"], "2026-01-01T12:00:00Z");

      await fs.writeFile(path.join(repo, "app.ts"), "base\nkept\nremoved\n");
      await commitAll(
        repo,
        [
          "agent change (#88)",
          "Co-authored-by: Claude <noreply@anthropic.com>"
        ],
        "2026-01-02T12:00:00Z"
      );

      await fs.writeFile(path.join(repo, "app.ts"), "base\nkept\n");
      await commitAll(repo, ["remove one line"], "2026-01-06T12:00:00Z");

      const result = await Effect.runPromise(
        scanRepository({
          repo,
          asOf: "2026-02-01T12:00:00Z",
          configPath: null,
          survivalDays: [1, 7],
          windowDays: 30,
          limit: 25,
          maxFilesPerChange: 40,
          maxAddedLinesPerChange: 2500,
          maxFileAddedLines: 750,
          blameTimeoutMs: 30000,
          copyDetection: false
        })
      );
      const aiChange = result.changes.find(
        (change) => change.commit.subject === "agent change (#88)"
      );

      expect(result.survivalDays).toEqual([1, 7]);
      expect(aiChange?.checkpoints.map((checkpoint) => checkpoint.survivalDays)).toEqual([
        1,
        7
      ]);
      expect(aiChange?.checkpoints[0]?.survivingLines).toBe(2);
      expect(aiChange?.checkpoints[1]?.survivingLines).toBe(1);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });
});
