#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { helpText, parseCliArgs } from "./args";
import { inspectRepository } from "./inspect";
import { renderInspectReport } from "./inspectReport";
import { renderMarkdownReport } from "./report";
import { scanRepository, type ScanProgress } from "./scanner";

const writeOutput = (
  out: string | null,
  markdown: string,
  defaultFileName: string
): Effect.Effect<string | null, Error> =>
  Effect.tryPromise({
    try: async () => {
      if (!out) {
        process.stdout.write(markdown);
        return null;
      }

      const isMarkdownFile = out.endsWith(".md");
      const filePath = isMarkdownFile ? out : path.join(out, defaultFileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, markdown);
      return filePath;
    },
    catch: (error) =>
      error instanceof Error
        ? error
        : new Error(`Unable to write report: ${String(error)}`)
  });

const program = Effect.gen(function* () {
  const config = parseCliArgs(process.argv);

  if (config.command === "help") {
    process.stdout.write(`${helpText}\n`);
    return;
  }

  if (config.command === "inspect") {
    const result = yield* inspectRepository({
      repo: config.repo,
      since: config.since,
      until: config.until,
      limit: config.limit
    });
    const markdown = renderInspectReport(result);
    const filePath = yield* writeOutput(
      config.out,
      markdown,
      "inspection-report.md"
    );

    if (filePath) {
      process.stdout.write(`Wrote ${filePath}\n`);
    }

    return;
  }

  const result = yield* scanRepository({
    repo: config.repo,
    since: config.since,
    until: config.until,
    configPath: config.configPath,
    horizonDays: config.horizonDays,
    limit: config.limit,
    maxFilesPerChange: config.maxFilesPerChange,
    maxAddedLinesPerChange: config.maxAddedLinesPerChange,
    maxFileAddedLines: config.maxFileAddedLines,
    blameTimeoutMs: config.blameTimeoutMs,
    copyDetection: config.copyDetection,
    onProgress: config.quiet ? undefined : writeProgress
  });
  const markdown = renderMarkdownReport(result);
  const filePath = yield* writeOutput(config.out, markdown, "survival-report.md");

  if (filePath) {
    process.stdout.write(`Wrote ${filePath}\n`);
  }
});

const writeProgress = (event: ScanProgress) => {
  if (event.type === "start") {
    process.stderr.write(`Scanning ${event.total} commits in ${event.repoRoot}\n`);
    return;
  }

  if (event.type === "commit") {
    process.stderr.write(
      `[${event.index}/${event.total}] ${event.shortSha} ${event.subject}\n`
    );
    return;
  }

  if (event.type === "blame-file") {
    process.stderr.write(
      `  blame ${event.fileIndex}/${event.fileTotal} ${event.path} (+${event.addedLines})\n`
    );
    return;
  }

  const summary =
    event.status === "scored"
      ? `${event.kind} scored ${event.survivingLines}/${event.addedLines} surviving lines`
      : `${event.kind} skipped: ${event.skipReason}`;

  process.stderr.write(`  ${summary}\n`);
};

Effect.runPromise(program).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
