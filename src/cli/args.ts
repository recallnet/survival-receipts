export interface CliConfig {
  command: "scan" | "inspect" | "help";
  repo: string;
  since: string;
  until: string | null;
  configPath: string | null;
  horizonDays: number;
  limit: number;
  maxFilesPerChange: number;
  maxAddedLinesPerChange: number;
  maxFileAddedLines: number;
  blameTimeoutMs: number;
  copyDetection: boolean;
  quiet: boolean;
  out: string | null;
  jsonOut: string | null;
}

const readFlag = (args: string[], name: string) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
};

const hasFlag = (args: string[], name: string) => args.includes(name);

const parsePositiveInteger = (
  value: string | null,
  fallback: number,
  label: string
) => {
  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

export const parseCliArgs = (argv: string[]): CliConfig => {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "scan";

  if (command === "help" || hasFlag(args, "--help") || hasFlag(args, "-h")) {
    return {
      command: "help",
      repo: ".",
      since: "6 months ago",
      until: null,
      configPath: null,
      horizonDays: 30,
      limit: 250,
      maxFilesPerChange: 25,
      maxAddedLinesPerChange: 1500,
      maxFileAddedLines: 300,
      blameTimeoutMs: 15000,
      copyDetection: false,
      quiet: false,
      out: null,
      jsonOut: null
    };
  }

  if (command !== "scan" && command !== "inspect") {
    throw new Error(`Unknown command: ${command}`);
  }

  return {
    command,
    repo: readFlag(args, "--repo") ?? ".",
    since: readFlag(args, "--since") ?? "6 months ago",
    until: readFlag(args, "--until"),
    configPath: readFlag(args, "--config"),
    horizonDays: parsePositiveInteger(readFlag(args, "--horizon"), 30, "--horizon"),
    limit: parsePositiveInteger(readFlag(args, "--limit"), 250, "--limit"),
    maxFilesPerChange: parsePositiveInteger(
      readFlag(args, "--max-files"),
      25,
      "--max-files"
    ),
    maxAddedLinesPerChange: parsePositiveInteger(
      readFlag(args, "--max-added-lines"),
      1500,
      "--max-added-lines"
    ),
    maxFileAddedLines: parsePositiveInteger(
      readFlag(args, "--max-file-added-lines"),
      300,
      "--max-file-added-lines"
    ),
    blameTimeoutMs: parsePositiveInteger(
      readFlag(args, "--blame-timeout-ms"),
      15000,
      "--blame-timeout-ms"
    ),
    copyDetection: hasFlag(args, "--copy-detection"),
    quiet: hasFlag(args, "--quiet"),
    out: readFlag(args, "--out"),
    jsonOut: readFlag(args, "--json-out")
  };
};

export const helpText = [
  "Survival Receipts CLI",
  "",
  "Usage:",
  "  pnpm survival scan --repo . --since 2025-12-01 --horizon 30 --out reports/demo",
  "  pnpm survival inspect --repo . --since 2025-12-01 --until 2026-01-31",
  "",
  "Options:",
  "  --repo <path>       Git repo to scan. Defaults to the current directory.",
  "  --since <date>      Git date expression passed to git log. Defaults to '6 months ago'.",
  "  --until <date>      Optional end date passed to git log.",
  "  --config <path>     Config file. Defaults to survival.config.json in the repo root when present.",
  "  --horizon <days>    Survival horizon in days. Defaults to 30.",
  "  --limit <count>     Max commits to inspect. Defaults to 250.",
  "  --max-files <count> Skip changes touching more included files. Defaults to 25.",
  "  --max-added-lines <count>",
  "                      Skip changes adding more included lines. Defaults to 1500.",
  "  --max-file-added-lines <count>",
  "                      Skip changes with one file above this added-line count. Defaults to 300.",
  "  --blame-timeout-ms <ms>",
  "                      Stop scoring a change when one blame call exceeds this. Defaults to 15000.",
  "  --copy-detection   Use slower git blame copy detection. Defaults to move detection only.",
  "  --quiet             Suppress progress logs.",
  "  --out <path>        Markdown file or directory. Prints to stdout when omitted.",
  "  --json-out <path>   JSON file or directory. Omit to skip JSON output.",
  "  --help             Show this help text."
].join("\n");
