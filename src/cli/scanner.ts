import path from "node:path";
import { Effect, Either } from "effect";
import { loadSurvivalConfig, type AiOverrideConfig } from "./config";
import { detectAiAttribution, type AiDetection } from "./markers";
import { resolveScanWindow } from "./window";
import {
  blamePorcelain,
  commitBefore,
  fileExistsAt,
  headSha,
  listCommitShas,
  readCommit,
  readNumstat,
  repoRoot,
  type FileChange,
  type GitCommit
} from "./git";

export interface ScanOptions {
  repo: string;
  asOf: string | null;
  configPath: string | null;
  survivalDays: number;
  windowDays: number;
  limit: number;
  maxFilesPerChange: number;
  maxAddedLinesPerChange: number;
  maxFileAddedLines: number;
  blameTimeoutMs: number;
  copyDetection: boolean;
  onProgress?: (event: ScanProgress) => void;
}

export type ScanProgress =
  | { type: "start"; repoRoot: string; total: number }
  | {
      type: "commit";
      index: number;
      total: number;
      shortSha: string;
      subject: string;
    }
  | {
      type: "blame-file";
      commitShortSha: string;
      fileIndex: number;
      fileTotal: number;
      path: string;
      addedLines: number;
    }
  | {
      type: "change";
      index: number;
      total: number;
      shortSha: string;
      kind: "ai" | "human";
      status: "scored" | "skipped";
      addedLines: number;
      survivingLines: number;
      skipReason: string | null;
    };

export interface FileSurvival {
  path: string;
  addedLines: number;
  survivingLines: number;
}

export interface ScannedChange {
  commit: GitCommit;
  prNumber: number | null;
  kind: "ai" | "human";
  ai: AiDetection;
  files: FileChange[];
  includedFiles: FileChange[];
  excludedFiles: FileChange[];
  addedLines: number;
  deletedLines: number;
  changedLines: number;
  estimatedAiCostUsd: number;
  survivalDate: string | null;
  targetSha: string | null;
  survivingLines: number;
  survivalRatio: number | null;
  fileSurvival: FileSurvival[];
  status: "scored" | "skipped";
  skipReason: string | null;
}

export interface ScanResult {
  generatedAt: string;
  repoInput: string;
  repoRoot: string;
  repoName: string;
  headSha: string;
  asOf: string;
  changeWindowStart: string;
  changeWindowEnd: string;
  configPath: string | null;
  configuredAiGithubUsernames: string[];
  configuredAiPrNumbers: number[];
  survivalDays: number;
  windowDays: number;
  limit: number;
  maxFilesPerChange: number;
  maxAddedLinesPerChange: number;
  maxFileAddedLines: number;
  blameTimeoutMs: number;
  copyDetection: boolean;
  commitsSeen: number;
  changes: ScannedChange[];
}

const excludedPathPatterns = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)vendor\//,
  /(^|\/)__generated__\//,
  /(^|\/)generated\//,
  /(^|\/)openapi\/(API\.md|openapi\.json)$/,
  /(^|\/)drizzle\/meta\//,
  /(^|\/)(AGENTS|CLAUDE)\.md$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/).*generated.*\.[cm]?[jt]sx?$/,
  /(^|\/).*\.min\.[cm]?js$/,
  /(^|\/).*\.map$/,
  /(^|\/).*\.snap$/,
  /\.(md|mdx)$/,
  /\.(png|jpg|jpeg|gif|webp|avif|ico|pdf|woff2?|ttf|otf)$/i
];

const isExcludedPath = (filePath: string) =>
  excludedPathPatterns.some((pattern) => pattern.test(filePath));

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const round = (value: number, digits = 2) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const sum = <T>(values: T[], select: (value: T) => number) =>
  values.reduce((total, value) => total + select(value), 0);

const estimateAiCostUsd = (change: {
  addedLines: number;
  deletedLines: number;
  fileCount: number;
}) => {
  const changedLines = change.addedLines + change.deletedLines;

  if (changedLines === 0) {
    return 0;
  }

  return round(Math.max(0.05, changedLines * 0.006 + change.fileCount * 0.02));
};

export const extractPrNumber = (subject: string) => {
  const squashMatch = subject.match(/\(#(\d+)\)\s*$/);

  if (squashMatch) {
    return Number.parseInt(squashMatch[1], 10);
  }

  const mergeMatch = subject.match(/merge pull request #(\d+)/i);

  if (mergeMatch) {
    return Number.parseInt(mergeMatch[1], 10);
  }

  return null;
};

const countBlamedLines = (porcelain: string, sourceSha: string) =>
  porcelain
    .split("\n")
    .filter((line) => line.startsWith(`${sourceSha} `)).length;

const scoreFile = (
  repo: string,
  sourceSha: string,
  targetSha: string,
  file: FileChange,
  blameTimeoutMs: number,
  copyDetection: boolean
): Effect.Effect<FileSurvival, Error> =>
  Effect.gen(function* () {
    const exists = yield* fileExistsAt(repo, targetSha, file.path);

    if (!exists) {
      return {
        path: file.path,
        addedLines: file.added,
        survivingLines: 0
      };
    }

    const blame = yield* blamePorcelain(
      repo,
      targetSha,
      file.path,
      blameTimeoutMs,
      copyDetection
    );
    const blamedLines = countBlamedLines(blame, sourceSha);

    return {
      path: file.path,
      addedLines: file.added,
      survivingLines: Math.min(blamedLines, file.added)
    };
  });

const scanCommit = (
  repo: string,
  commit: GitCommit,
  options: Omit<ScanOptions, "repo" | "asOf" | "configPath" | "limit"> & {
    aiOverrides: AiOverrideConfig;
    asOf: string;
  },
  progressContext: { index: number; total: number }
): Effect.Effect<ScannedChange, Error> =>
  Effect.gen(function* () {
    const prNumber = extractPrNumber(commit.subject);
    const ai = detectAiAttribution({
      message: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
      committerName: commit.committerName,
      committerEmail: commit.committerEmail,
      prNumber,
      overrides: options.aiOverrides
    });
    const kind: "ai" | "human" = ai.isAi ? "ai" : "human";
    const base = {
      commit,
      prNumber,
      kind,
      ai
    };
    const skipped = (input: {
      files?: FileChange[];
      includedFiles?: FileChange[];
      excludedFiles?: FileChange[];
      addedLines?: number;
      deletedLines?: number;
      changedLines?: number;
      estimatedAiCostUsd?: number;
      survivalDate?: string | null;
      targetSha?: string | null;
      skipReason: string;
    }): ScannedChange => ({
      ...base,
      files: input.files ?? [],
      includedFiles: input.includedFiles ?? [],
      excludedFiles: input.excludedFiles ?? [],
      addedLines: input.addedLines ?? 0,
      deletedLines: input.deletedLines ?? 0,
      changedLines: input.changedLines ?? 0,
      estimatedAiCostUsd: input.estimatedAiCostUsd ?? 0,
      survivalDate: input.survivalDate ?? null,
      targetSha: input.targetSha ?? null,
      survivingLines: 0,
      survivalRatio: null,
      fileSurvival: [],
      status: "skipped",
      skipReason: input.skipReason
    });

    if (commit.parentShas.length !== 1) {
      return skipped({
        skipReason:
          commit.parentShas.length === 0
            ? "initial commit has no parent"
            : "merge commit support needs branch reconstruction"
      });
    }

    const files = yield* readNumstat(repo, commit.sha);
    const includedFiles = files.filter(
      (file) => !isExcludedPath(file.path) && file.added > 0
    );
    const excludedFiles = files.filter(
      (file) => isExcludedPath(file.path) || file.added === 0
    );
    const addedLines = sum(includedFiles, (file) => file.added);
    const deletedLines = sum(includedFiles, (file) => file.deleted);
    const changedLines = addedLines + deletedLines;
    const estimatedAiCostUsd =
      kind === "ai"
        ? estimateAiCostUsd({
            addedLines,
            deletedLines,
            fileCount: includedFiles.length
          })
        : 0;
    const skipShared = {
      files,
      includedFiles,
      excludedFiles,
      addedLines,
      deletedLines,
      changedLines,
      estimatedAiCostUsd
    };

    if (includedFiles.length === 0 || addedLines === 0) {
      return skipped({
        ...skipShared,
        skipReason: "no included added lines"
      });
    }

    if (includedFiles.length > options.maxFilesPerChange) {
      return skipped({
        ...skipShared,
        skipReason: `change touches ${includedFiles.length} included files, above --max-files ${options.maxFilesPerChange}`
      });
    }

    if (addedLines > options.maxAddedLinesPerChange) {
      return skipped({
        ...skipShared,
        skipReason: `change adds ${addedLines} included lines, above --max-added-lines ${options.maxAddedLinesPerChange}`
      });
    }

    const oversizedFile = includedFiles.find(
      (file) => file.added > options.maxFileAddedLines
    );

    if (oversizedFile) {
      return skipped({
        ...skipShared,
        skipReason: `${oversizedFile.path} adds ${oversizedFile.added} lines, above --max-file-added-lines ${options.maxFileAddedLines}`
      });
    }

    const survivalDate = addDays(new Date(commit.committedAt), options.survivalDays);
    const asOf = new Date(options.asOf);

    if (survivalDate.getTime() > asOf.getTime()) {
      return skipped({
        ...skipShared,
        survivalDate: survivalDate.toISOString(),
        skipReason: `commit has not reached ${options.survivalDays} day survival age`
      });
    }

    const targetSha = yield* commitBefore(repo, survivalDate.toISOString());

    if (!targetSha) {
      return skipped({
        ...skipShared,
        survivalDate: survivalDate.toISOString(),
        skipReason: "no commit exists at the survival date"
      });
    }

    const fileSurvival: FileSurvival[] = [];

    for (const [fileIndex, file] of includedFiles.entries()) {
      options.onProgress?.({
        type: "blame-file",
        commitShortSha: commit.shortSha,
        fileIndex: fileIndex + 1,
        fileTotal: includedFiles.length,
        path: file.path,
        addedLines: file.added
      });

      const scoredFile = yield* Effect.either(
        scoreFile(
          repo,
          commit.sha,
          targetSha,
          file,
          options.blameTimeoutMs,
          options.copyDetection
        )
      );

      if (Either.isLeft(scoredFile)) {
        return skipped({
          ...skipShared,
          survivalDate: survivalDate.toISOString(),
          targetSha,
          skipReason: `git blame failed for ${file.path}: ${scoredFile.left.message}`
        });
      }

      fileSurvival.push(scoredFile.right);
    }

    const survivingLines = sum(fileSurvival, (file) => file.survivingLines);
    const survivalRatio = addedLines > 0 ? survivingLines / addedLines : 0;

    return {
      ...base,
      files,
      includedFiles,
      excludedFiles,
      addedLines,
      deletedLines,
      changedLines,
      estimatedAiCostUsd,
      survivalDate: survivalDate.toISOString(),
      targetSha,
      survivingLines,
      survivalRatio: round(survivalRatio, 4),
      fileSurvival,
      status: "scored",
      skipReason: null
    };
  });

export const scanRepository = (
  options: ScanOptions
): Effect.Effect<ScanResult, Error> =>
  Effect.gen(function* () {
    const root = yield* repoRoot(options.repo);
    const config = yield* loadSurvivalConfig(root, options.configPath);
    const head = yield* headSha(root);
    const window = resolveScanWindow(
      options.asOf,
      options.survivalDays,
      options.windowDays
    );
    const shas = yield* listCommitShas(root, {
      since: window.changeWindowStart,
      until: window.changeWindowEnd,
      limit: options.limit
    });
    const changes: ScannedChange[] = [];
    options.onProgress?.({ type: "start", repoRoot: root, total: shas.length });

    for (const [index, sha] of shas.entries()) {
      const commit = yield* readCommit(root, sha);
      options.onProgress?.({
        type: "commit",
        index: index + 1,
        total: shas.length,
        shortSha: commit.shortSha,
        subject: commit.subject
      });
      const change = yield* scanCommit(
        root,
        commit,
        {
          survivalDays: options.survivalDays,
          windowDays: options.windowDays,
          maxFilesPerChange: options.maxFilesPerChange,
          maxAddedLinesPerChange: options.maxAddedLinesPerChange,
          maxFileAddedLines: options.maxFileAddedLines,
          blameTimeoutMs: options.blameTimeoutMs,
          copyDetection: options.copyDetection,
          aiOverrides: config.ai,
          asOf: window.asOf,
          onProgress: options.onProgress
        },
        { index: index + 1, total: shas.length }
      );
      changes.push(change);
      options.onProgress?.({
        type: "change",
        index: index + 1,
        total: shas.length,
        shortSha: commit.shortSha,
        kind: change.kind,
        status: change.status,
        addedLines: change.addedLines,
        survivingLines: change.survivingLines,
        skipReason: change.skipReason
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      repoInput: options.repo,
      repoRoot: root,
      repoName: path.basename(root),
      headSha: head,
      asOf: window.asOf,
      changeWindowStart: window.changeWindowStart,
      changeWindowEnd: window.changeWindowEnd,
      configPath: config.path,
      configuredAiGithubUsernames: config.ai.githubUsernames,
      configuredAiPrNumbers: config.ai.prNumbers,
      survivalDays: options.survivalDays,
      windowDays: options.windowDays,
      limit: options.limit,
      maxFilesPerChange: options.maxFilesPerChange,
      maxAddedLinesPerChange: options.maxAddedLinesPerChange,
      maxFileAddedLines: options.maxFileAddedLines,
      blameTimeoutMs: options.blameTimeoutMs,
      copyDetection: options.copyDetection,
      commitsSeen: shas.length,
      changes
    };
  });
