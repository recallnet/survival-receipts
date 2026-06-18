import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { inspectRepository, extractPrTitle } from "./inspect";
import { renderInspectReport } from "./inspectReport";
import type { GitCommit } from "./git";

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

const commitAll = async (
  repo: string,
  message: string[],
  date: string,
  author?: { name: string; email: string }
) => {
  await git(repo, ["add", "."]);
  await git(repo, ["commit", ...message.flatMap((part) => ["-m", part])], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
    ...(author
      ? {
          GIT_AUTHOR_NAME: author.name,
          GIT_AUTHOR_EMAIL: author.email
        }
      : {})
  });
};

const fakeCommit = (input: Partial<GitCommit>): GitCommit => ({
  sha: "abc",
  shortSha: "abc",
  parentShas: ["parent"],
  authorName: "Ada",
  authorEmail: "ada@example.com",
  committerName: "Ada",
  committerEmail: "ada@example.com",
  committedAt: "2026-01-01T00:00:00Z",
  subject: "subject",
  message: "subject",
  ...input
});

describe("CLI inspect command", () => {
  it("extracts PR titles from squash and merge commit messages", () => {
    expect(
      extractPrTitle(fakeCommit({ subject: "Add billing export (#123)" }))
    ).toBe("Add billing export");

    expect(
      extractPrTitle(
        fakeCommit({
          subject: "Merge pull request #456 from recall/branch",
          message:
            "Merge pull request #456 from recall/branch\n\nFix checkpoint restore"
        })
      )
    ).toBe("Fix checkpoint restore");
  });

  it("lists unique contributors and detected PRs", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "survival-inspect-"));

    try {
      await execFileAsync("git", ["init", repo]);
      await git(repo, ["config", "user.name", "Test User"]);
      await git(repo, ["config", "user.email", "test@example.com"]);

      await fs.writeFile(path.join(repo, "app.ts"), "base\n");
      await commitAll(repo, ["initial"], "2026-01-01T12:00:00Z", {
        name: "Ada",
        email: "ada@example.com"
      });

      await fs.writeFile(path.join(repo, "app.ts"), "base\none\n");
      await commitAll(repo, ["Add first feature (#12)"], "2026-01-02T12:00:00Z", {
        name: "Ada",
        email: "ada@example.com"
      });

      await fs.writeFile(path.join(repo, "app.ts"), "base\none\ntwo\n");
      await commitAll(repo, ["Add second feature (#13)"], "2026-01-03T12:00:00Z", {
        name: "cto-new[bot]",
        email: "12345+cto-new[bot]@users.noreply.github.com"
      });

      const result = await Effect.runPromise(
        inspectRepository({
          repo,
          since: "2026-01-01",
          until: "2026-01-31",
          limit: 25
        })
      );
      const report = renderInspectReport(result);

      expect(result.commitsSeen).toBe(2);
      expect(result.contributors).toHaveLength(2);
      expect(result.pullRequests.map((pr) => pr.number)).toEqual([13, 12]);
      expect(result.pullRequests.find((pr) => pr.number === 12)?.title).toBe(
        "Add first feature"
      );
      expect(
        result.contributors.find((contributor) =>
          contributor.githubUsernames.includes("cto-new[bot]")
        )
      ).toBeDefined();
      expect(report).toContain("## Contributors");
      expect(report).toContain("## Detected PRs");
      expect(report).toContain("#13");
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });
});
