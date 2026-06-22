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
      "--since",
      "2026-01-01",
      "--out",
      "reports/survival-report.md",
      "--json-out",
      "reports/survival-report.json"
    ]);

    expect(config.out).toBe("reports/survival-report.md");
    expect(config.jsonOut).toBe("reports/survival-report.json");
  });
});
