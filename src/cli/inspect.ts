import path from "node:path";
import { Effect } from "effect";
import {
  headSha,
  listCommitShas,
  readCommit,
  repoRoot,
  type GitCommit
} from "./git";
import { githubUsernamesForIdentity } from "./markers";
import { extractPrNumber } from "./scanner";

export interface InspectOptions {
  repo: string;
  since: string;
  until: string | null;
  limit: number;
}

interface ContributorSummary {
  name: string;
  email: string;
  githubUsernames: string[];
  commits: number;
  prs: number[];
}

interface PullRequestSummary {
  number: number;
  title: string;
  commits: number;
  authors: string[];
  firstCommitAt: string;
  lastCommitAt: string;
}

export interface InspectResult {
  generatedAt: string;
  repoRoot: string;
  repoName: string;
  headSha: string;
  since: string;
  until: string | null;
  limit: number;
  commitsSeen: number;
  contributors: ContributorSummary[];
  pullRequests: PullRequestSummary[];
}

const contributorKey = (commit: GitCommit) =>
  `${commit.authorName.trim().toLowerCase()}\x1f${commit.authorEmail
    .trim()
    .toLowerCase()}`;

const displayContributor = (commit: GitCommit) =>
  commit.authorEmail.trim().length > 0
    ? `${commit.authorName} <${commit.authorEmail}>`
    : commit.authorName;

export const extractPrTitle = (commit: GitCommit) => {
  const squashTitle = commit.subject.replace(/\s+\(#\d+\)\s*$/, "").trim();

  if (!/^merge pull request #\d+/i.test(commit.subject)) {
    return squashTitle;
  }

  const bodyTitle = commit.message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== commit.subject)
    .at(0);

  return bodyTitle ?? commit.subject;
};

const summarizeContributors = (commits: GitCommit[]) => {
  const contributors = new Map<string, ContributorSummary>();

  for (const commit of commits) {
    const key = contributorKey(commit);
    const existing = contributors.get(key);
    const prNumber = extractPrNumber(commit.subject);

    if (existing) {
      existing.commits += 1;

      if (prNumber !== null && !existing.prs.includes(prNumber)) {
        existing.prs.push(prNumber);
      }

      continue;
    }

    contributors.set(key, {
      name: commit.authorName,
      email: commit.authorEmail,
      githubUsernames: githubUsernamesForIdentity({
        name: commit.authorName,
        email: commit.authorEmail
      }),
      commits: 1,
      prs: prNumber === null ? [] : [prNumber]
    });
  }

  return [...contributors.values()]
    .map((contributor) => ({
      ...contributor,
      prs: contributor.prs.sort((a, b) => a - b)
    }))
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
};

const summarizePullRequests = (commits: GitCommit[]) => {
  const pullRequests = new Map<number, PullRequestSummary>();

  for (const commit of commits) {
    const number = extractPrNumber(commit.subject);

    if (number === null) {
      continue;
    }

    const existing = pullRequests.get(number);
    const author = displayContributor(commit);

    if (existing) {
      existing.commits += 1;

      if (!existing.authors.includes(author)) {
        existing.authors.push(author);
      }

      if (commit.committedAt < existing.firstCommitAt) {
        existing.firstCommitAt = commit.committedAt;
      }

      if (commit.committedAt > existing.lastCommitAt) {
        existing.lastCommitAt = commit.committedAt;
      }

      continue;
    }

    pullRequests.set(number, {
      number,
      title: extractPrTitle(commit),
      commits: 1,
      authors: [author],
      firstCommitAt: commit.committedAt,
      lastCommitAt: commit.committedAt
    });
  }

  return [...pullRequests.values()].sort((a, b) => b.number - a.number);
};

export const inspectRepository = (
  options: InspectOptions
): Effect.Effect<InspectResult, Error> =>
  Effect.gen(function* () {
    const root = yield* repoRoot(options.repo);
    const head = yield* headSha(root);
    const shas = yield* listCommitShas(root, {
      since: options.since,
      until: options.until,
      limit: options.limit
    });
    const commits: GitCommit[] = [];

    for (const sha of shas) {
      commits.push(yield* readCommit(root, sha));
    }

    return {
      generatedAt: new Date().toISOString(),
      repoRoot: root,
      repoName: path.basename(root),
      headSha: head,
      since: options.since,
      until: options.until,
      limit: options.limit,
      commitsSeen: commits.length,
      contributors: summarizeContributors(commits),
      pullRequests: summarizePullRequests(commits)
    };
  });

