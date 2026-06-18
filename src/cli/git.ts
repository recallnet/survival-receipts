import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execFileAsync = promisify(execFile);
const maxBuffer = 1024 * 1024 * 64;

export interface GitCommit {
  sha: string;
  shortSha: string;
  parentShas: string[];
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  committedAt: string;
  subject: string;
  message: string;
}

export interface FileChange {
  path: string;
  added: number;
  deleted: number;
}

const commandText = (repo: string, args: string[]) =>
  `git -C ${repo} ${args.join(" ")}`;

const git = (
  repo: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeoutMs?: number
): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const result = await execFileAsync("git", ["-C", repo, ...args], {
        env: env ? { ...process.env, ...env } : process.env,
        maxBuffer,
        timeout: timeoutMs
      });

      return result.stdout.trimEnd();
    },
    catch: (error) => {
      const message =
        error instanceof Error ? error.message : `Unknown git error: ${error}`;

      return new Error(`${commandText(repo, args)} failed\n${message}`);
    }
  });

export const repoRoot = (repo: string) =>
  git(repo, ["rev-parse", "--show-toplevel"]);

export const headSha = (repo: string) => git(repo, ["rev-parse", "HEAD"]);

export const listCommitShas = (
  repo: string,
  options: { since: string; until: string | null; limit: number }
): Effect.Effect<string[], Error> =>
  Effect.map(
    git(repo, [
      "log",
      `--since=${options.since}`,
      ...(options.until ? [`--until=${options.until}`] : []),
      `--max-count=${options.limit}`,
      "--format=%H"
    ]),
    (stdout) => stdout.split("\n").filter(Boolean)
  );

export const readCommit = (
  repo: string,
  sha: string
): Effect.Effect<GitCommit, Error> =>
  Effect.map(
    git(repo, [
      "show",
      "-s",
      "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%aI%x1f%s%x1f%B",
      sha
    ]),
    (stdout) => {
      const [fullSha, parents, authorName, authorEmail, committerName, committerEmail, committedAt, subject, ...messageParts] =
        stdout.split("\x1f");
      const message = messageParts.join("\x1f");

      return {
        sha: fullSha,
        shortSha: fullSha.slice(0, 12),
        parentShas: parents.trim().length > 0 ? parents.split(" ") : [],
        authorName,
        authorEmail,
        committerName,
        committerEmail,
        committedAt,
        subject,
        message
      };
    }
  );

export const readNumstat = (
  repo: string,
  sha: string
): Effect.Effect<FileChange[], Error> =>
  Effect.map(
    git(repo, ["diff", "--numstat", "--find-renames", `${sha}^`, sha, "--"]),
    (stdout) =>
      stdout
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          const [addedText, deletedText, ...pathParts] = line.split("\t");
          const path = pathParts.join("\t");
          const added = Number.parseInt(addedText, 10);
          const deleted = Number.parseInt(deletedText, 10);

          if (!Number.isFinite(added) || !Number.isFinite(deleted) || !path) {
            return [];
          }

          return [{ path, added, deleted }];
        })
  );

export const commitBefore = (
  repo: string,
  isoDate: string
): Effect.Effect<string | null, Error> =>
  Effect.map(
    git(repo, ["rev-list", "-n", "1", `--before=${isoDate}`, "HEAD"]),
    (stdout) => (stdout.length > 0 ? stdout : null)
  );

export const blamePorcelain = (
  repo: string,
  sha: string,
  path: string,
  timeoutMs: number,
  copyDetection: boolean
): Effect.Effect<string, Error> =>
  git(
    repo,
    [
      "blame",
      "-M",
      ...(copyDetection ? ["-C", "-C"] : []),
      "--line-porcelain",
      sha,
      "--",
      path
    ],
    undefined,
    timeoutMs
  );

export const fileExistsAt = (
  repo: string,
  sha: string,
  path: string
): Effect.Effect<boolean, never> =>
  Effect.promise(async () => {
    try {
      await execFileAsync("git", ["-C", repo, "cat-file", "-e", `${sha}:${path}`], {
        maxBuffer
      });
      return true;
    } catch {
      return false;
    }
  });
