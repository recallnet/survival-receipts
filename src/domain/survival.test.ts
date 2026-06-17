import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { mockPullRequests } from "./mockData";
import { scoreWorkspace } from "./survival";

describe("AI change survival scoring", () => {
  it("ranks durable work above review-heavy cleanup work", () => {
    const score = Effect.runSync(scoreWorkspace(mockPullRequests, "day30"));
    const auditExport = score.pullRequests.find((pr) => pr.number === 1868);
    const checkoutRetry = score.pullRequests.find((pr) => pr.number === 1849);

    expect(auditExport).toBeDefined();
    expect(checkoutRetry).toBeDefined();
    expect(auditExport!.survivalScore).toBeGreaterThan(
      checkoutRetry!.survivalScore
    );
    expect(auditExport!.verdict).toBe("durable");
    expect(checkoutRetry!.verdict).toBe("sludge");
  });

  it("keeps the workspace metric tied to survived output per dollar", () => {
    const score = Effect.runSync(scoreWorkspace(mockPullRequests, "day14"));

    expect(score.hunksPer100Dollars).toBeGreaterThan(0);
    expect(score.dollarsPerSurvivedHunk).toBeGreaterThan(0);
    expect(score.cleanupLeaks[0]?.cleanupTaxUsd).toBeGreaterThan(
      score.cleanupLeaks[2]?.cleanupTaxUsd ?? 0
    );
  });
});
