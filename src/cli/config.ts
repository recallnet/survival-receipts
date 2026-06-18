import fs from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";

export interface AiOverrideConfig {
  githubUsernames: string[];
  prNumbers: number[];
}

export interface SurvivalConfig {
  path: string | null;
  ai: AiOverrideConfig;
}

export const emptyAiOverrideConfig: AiOverrideConfig = {
  githubUsernames: [],
  prNumbers: []
};

const defaultConfigFile = "survival.config.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseStringArray = (
  value: unknown,
  field: string,
  filePath: string
): string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} in ${filePath} must be an array`);
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`${field} in ${filePath} must contain non-empty strings`);
    }

    return item.trim();
  });
};

const parseNumberArray = (
  value: unknown,
  field: string,
  filePath: string
): number[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} in ${filePath} must be an array`);
  }

  return value.map((item) => {
    const number =
      typeof item === "number"
        ? item
        : typeof item === "string"
          ? Number.parseInt(item, 10)
          : Number.NaN;

    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`${field} in ${filePath} must contain PR numbers`);
    }

    return number;
  });
};

const uniqueSortedNumbers = (values: number[]) =>
  [...new Set(values)].sort((a, b) => a - b);

const uniqueSortedStrings = (values: string[]) =>
  [...new Set(values.map((value) => value.toLowerCase()))].sort((a, b) =>
    a.localeCompare(b)
  );

const parseConfig = (raw: unknown, filePath: string): SurvivalConfig => {
  if (!isRecord(raw)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }

  const ai = raw.ai;

  if (ai !== undefined && !isRecord(ai)) {
    throw new Error(`ai in ${filePath} must be an object`);
  }

  return {
    path: filePath,
    ai: {
      githubUsernames: uniqueSortedStrings(
        parseStringArray(ai?.githubUsernames, "ai.githubUsernames", filePath)
      ),
      prNumbers: uniqueSortedNumbers(
        parseNumberArray(ai?.prNumbers, "ai.prNumbers", filePath)
      )
    }
  };
};

const exists = (filePath: string): Effect.Effect<boolean, never> =>
  Effect.promise(async () => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

export const loadSurvivalConfig = (
  repoRoot: string,
  configPath: string | null
): Effect.Effect<SurvivalConfig, Error> =>
  Effect.gen(function* () {
    const filePath = configPath
      ? path.resolve(configPath)
      : path.join(repoRoot, defaultConfigFile);
    const found = yield* exists(filePath);

    if (!found) {
      if (configPath) {
        return yield* Effect.fail(new Error(`Config file not found: ${filePath}`));
      }

      return {
        path: null,
        ai: emptyAiOverrideConfig
      };
    }

    const text = yield* Effect.tryPromise({
      try: () => fs.readFile(filePath, "utf8"),
      catch: (error) =>
        error instanceof Error
          ? error
          : new Error(`Unable to read config: ${String(error)}`)
    });

    const raw = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (error) =>
        error instanceof Error
          ? new Error(`Invalid JSON in ${filePath}: ${error.message}`)
          : new Error(`Invalid JSON in ${filePath}`)
    });

    return parseConfig(raw, filePath);
  });

