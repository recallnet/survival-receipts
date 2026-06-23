import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args";

describe("CLI args", () => {
  it("parses Markdown and JSON output paths", () => {
    const config = parseCliArgs([
      "node",
      "main.ts",
      "scan",
      "--repo",
      ".",
      "--survival-days",
      "45,7,45",
      "--window-days",
      "7",
      "--from-commit",
      "abc123",
      "--to-commit",
      "def456",
      "--out",
      "reports/survival-report.md",
      "--json-out",
      "reports/survival-report.json"
    ]);

    expect(config.out).toBe("reports/survival-report.md");
    expect(config.jsonOut).toBe("reports/survival-report.json");
    expect(config.survivalDays).toEqual([7, 45]);
    expect(config.windowDays).toBe(7);
    expect(config.fromCommit).toBe("abc123");
    expect(config.toCommit).toBe("def456");
  });

  it("requires a range end when a range start is provided", () => {
    expect(() =>
      parseCliArgs(["node", "main.ts", "scan", "--from-commit", "abc123"])
    ).toThrow("--from-commit requires --to-commit");
  });

  it("rejects removed window flags", () => {
    expect(() =>
      parseCliArgs(["node", "main.ts", "scan", "--since", "2026-01-01"])
    ).toThrow("--since was removed");

    expect(() =>
      parseCliArgs(["node", "main.ts", "scan", "--horizon", "30"])
    ).toThrow("--horizon was removed");

    expect(() =>
      parseCliArgs(["node", "main.ts", "scan", "--until", "2026-01-01"])
    ).toThrow("--until was renamed");

    expect(() =>
      parseCliArgs(["node", "main.ts", "scan", "--lookback", "30"])
    ).toThrow("--lookback was split");
  });
});
