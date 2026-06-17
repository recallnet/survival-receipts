import type { PullRequestRecord } from "./survival";

export const mockPullRequests: PullRequestRecord[] = [
  {
    id: "pr-1842",
    number: 1842,
    title: "Prompt cache key isolation",
    repo: "recall/app",
    team: "Platform",
    author: "Maya",
    agent: "Claude Code",
    mergedAt: "2026-05-08",
    shippedSurface: "agent runtime",
    ai: {
      provider: "Anthropic",
      model: "Claude Opus",
      sessions: 7,
      inputTokens: 842000,
      outputTokens: 119000,
      costUsd: 38.6,
      confidence: 0.84,
      source: "cli-log"
    },
    review: {
      changedFiles: 9,
      linesChanged: 612,
      semanticHunks: 42,
      reviewComments: 19,
      authorRevisionRounds: 2,
      reviewerRewritePct: 0.07,
      ciFailures: 1
    },
    survival: {
      forecast: {
        hunkSurvival: 0.91,
        postMergeChurn: 0.04,
        followUpTouchCount: 1,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.72
      },
      day7: {
        hunkSurvival: 0.9,
        postMergeChurn: 0.05,
        followUpTouchCount: 1,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.78
      },
      day14: {
        hunkSurvival: 0.88,
        postMergeChurn: 0.06,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.82
      },
      day30: {
        hunkSurvival: 0.86,
        postMergeChurn: 0.07,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.86
      }
    }
  },
  {
    id: "pr-1849",
    number: 1849,
    title: "Checkout retry state machine",
    repo: "recall/web",
    team: "Growth",
    author: "Owen",
    agent: "Cursor Agent",
    mergedAt: "2026-05-10",
    shippedSurface: "checkout",
    ai: {
      provider: "OpenAI",
      model: "GPT-5 Codex",
      sessions: 16,
      inputTokens: 1740000,
      outputTokens: 231000,
      costUsd: 96.4,
      confidence: 0.76,
      source: "branch-timing"
    },
    review: {
      changedFiles: 18,
      linesChanged: 1430,
      semanticHunks: 64,
      reviewComments: 96,
      authorRevisionRounds: 6,
      reviewerRewritePct: 0.41,
      ciFailures: 5
    },
    survival: {
      forecast: {
        hunkSurvival: 0.72,
        postMergeChurn: 0.14,
        followUpTouchCount: 3,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.55
      },
      day7: {
        hunkSurvival: 0.5,
        postMergeChurn: 0.31,
        followUpTouchCount: 7,
        defectLinks: 1,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.68
      },
      day14: {
        hunkSurvival: 0.39,
        postMergeChurn: 0.43,
        followUpTouchCount: 11,
        defectLinks: 2,
        hotfixLinks: 1,
        revertCount: 0,
        confidence: 0.82
      },
      day30: {
        hunkSurvival: 0.34,
        postMergeChurn: 0.46,
        followUpTouchCount: 13,
        defectLinks: 2,
        hotfixLinks: 1,
        revertCount: 1,
        confidence: 0.88
      }
    }
  },
  {
    id: "pr-1851",
    number: 1851,
    title: "Support macros bulk import",
    repo: "recall/ops",
    team: "Ops",
    author: "Priya",
    agent: "Claude Code",
    mergedAt: "2026-05-13",
    shippedSurface: "support console",
    ai: {
      provider: "Anthropic",
      model: "Claude Sonnet",
      sessions: 4,
      inputTokens: 394000,
      outputTokens: 62000,
      costUsd: 22.1,
      confidence: 0.88,
      source: "cli-log"
    },
    review: {
      changedFiles: 7,
      linesChanged: 388,
      semanticHunks: 30,
      reviewComments: 10,
      authorRevisionRounds: 1,
      reviewerRewritePct: 0.03,
      ciFailures: 0
    },
    survival: {
      forecast: {
        hunkSurvival: 0.93,
        postMergeChurn: 0.03,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.75
      },
      day7: {
        hunkSurvival: 0.93,
        postMergeChurn: 0.03,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.82
      },
      day14: {
        hunkSurvival: 0.91,
        postMergeChurn: 0.04,
        followUpTouchCount: 1,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.86
      },
      day30: {
        hunkSurvival: 0.89,
        postMergeChurn: 0.05,
        followUpTouchCount: 1,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.9
      }
    }
  },
  {
    id: "pr-1856",
    number: 1856,
    title: "Billing entitlement migration",
    repo: "recall/api",
    team: "Platform",
    author: "Jon",
    agent: "Codex",
    mergedAt: "2026-05-16",
    shippedSurface: "billing",
    ai: {
      provider: "OpenAI",
      model: "GPT-5 Codex",
      sessions: 10,
      inputTokens: 1190000,
      outputTokens: 174000,
      costUsd: 74.2,
      confidence: 0.71,
      source: "declared"
    },
    review: {
      changedFiles: 21,
      linesChanged: 1184,
      semanticHunks: 58,
      reviewComments: 52,
      authorRevisionRounds: 4,
      reviewerRewritePct: 0.18,
      ciFailures: 2
    },
    survival: {
      forecast: {
        hunkSurvival: 0.8,
        postMergeChurn: 0.1,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.62
      },
      day7: {
        hunkSurvival: 0.77,
        postMergeChurn: 0.13,
        followUpTouchCount: 3,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.7
      },
      day14: {
        hunkSurvival: 0.7,
        postMergeChurn: 0.18,
        followUpTouchCount: 4,
        defectLinks: 1,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.78
      },
      day30: {
        hunkSurvival: 0.67,
        postMergeChurn: 0.22,
        followUpTouchCount: 5,
        defectLinks: 1,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.84
      }
    }
  },
  {
    id: "pr-1861",
    number: 1861,
    title: "Search relevance experiment",
    repo: "recall/web",
    team: "Growth",
    author: "Leah",
    agent: "Cursor Agent",
    mergedAt: "2026-05-19",
    shippedSurface: "search",
    ai: {
      provider: "OpenAI",
      model: "GPT-5 Codex",
      sessions: 9,
      inputTokens: 860000,
      outputTokens: 131000,
      costUsd: 52.7,
      confidence: 0.67,
      source: "branch-timing"
    },
    review: {
      changedFiles: 12,
      linesChanged: 792,
      semanticHunks: 39,
      reviewComments: 28,
      authorRevisionRounds: 3,
      reviewerRewritePct: 0.11,
      ciFailures: 1
    },
    survival: {
      forecast: {
        hunkSurvival: 0.76,
        postMergeChurn: 0.09,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.57
      },
      day7: {
        hunkSurvival: 0.68,
        postMergeChurn: 0.18,
        followUpTouchCount: 4,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.7
      },
      day14: {
        hunkSurvival: 0.54,
        postMergeChurn: 0.31,
        followUpTouchCount: 6,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.78
      },
      day30: {
        hunkSurvival: 0.41,
        postMergeChurn: 0.49,
        followUpTouchCount: 8,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.86
      }
    }
  },
  {
    id: "pr-1868",
    number: 1868,
    title: "Audit log CSV export",
    repo: "recall/app",
    team: "Platform",
    author: "Nina",
    agent: "Claude Code",
    mergedAt: "2026-05-22",
    shippedSurface: "admin",
    ai: {
      provider: "Anthropic",
      model: "Claude Sonnet",
      sessions: 3,
      inputTokens: 250000,
      outputTokens: 31000,
      costUsd: 13.4,
      confidence: 0.91,
      source: "cli-log"
    },
    review: {
      changedFiles: 5,
      linesChanged: 244,
      semanticHunks: 18,
      reviewComments: 4,
      authorRevisionRounds: 1,
      reviewerRewritePct: 0.02,
      ciFailures: 0
    },
    survival: {
      forecast: {
        hunkSurvival: 0.95,
        postMergeChurn: 0.02,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.79
      },
      day7: {
        hunkSurvival: 0.95,
        postMergeChurn: 0.02,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.86
      },
      day14: {
        hunkSurvival: 0.94,
        postMergeChurn: 0.03,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.9
      },
      day30: {
        hunkSurvival: 0.94,
        postMergeChurn: 0.03,
        followUpTouchCount: 0,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.94
      }
    }
  },
  {
    id: "pr-1874",
    number: 1874,
    title: "Agent workspace memory compaction",
    repo: "recall/agent",
    team: "AI Infra",
    author: "Sam",
    agent: "Codex",
    mergedAt: "2026-05-25",
    shippedSurface: "agent runtime",
    ai: {
      provider: "OpenAI",
      model: "GPT-5 Codex",
      sessions: 24,
      inputTokens: 2680000,
      outputTokens: 388000,
      costUsd: 181.2,
      confidence: 0.86,
      source: "gateway"
    },
    review: {
      changedFiles: 26,
      linesChanged: 1710,
      semanticHunks: 86,
      reviewComments: 54,
      authorRevisionRounds: 4,
      reviewerRewritePct: 0.09,
      ciFailures: 2
    },
    survival: {
      forecast: {
        hunkSurvival: 0.86,
        postMergeChurn: 0.06,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.7
      },
      day7: {
        hunkSurvival: 0.85,
        postMergeChurn: 0.08,
        followUpTouchCount: 3,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.78
      },
      day14: {
        hunkSurvival: 0.82,
        postMergeChurn: 0.11,
        followUpTouchCount: 4,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.84
      },
      day30: {
        hunkSurvival: 0.8,
        postMergeChurn: 0.12,
        followUpTouchCount: 4,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.88
      }
    }
  },
  {
    id: "pr-1879",
    number: 1879,
    title: "Sidebar settings redesign",
    repo: "recall/web",
    team: "Product",
    author: "Theo",
    agent: "Claude Code",
    mergedAt: "2026-05-28",
    shippedSurface: "settings",
    ai: {
      provider: "Anthropic",
      model: "Claude Sonnet",
      sessions: 6,
      inputTokens: 512000,
      outputTokens: 76000,
      costUsd: 28.9,
      confidence: 0.79,
      source: "declared"
    },
    review: {
      changedFiles: 14,
      linesChanged: 690,
      semanticHunks: 37,
      reviewComments: 44,
      authorRevisionRounds: 4,
      reviewerRewritePct: 0.24,
      ciFailures: 1
    },
    survival: {
      forecast: {
        hunkSurvival: 0.78,
        postMergeChurn: 0.12,
        followUpTouchCount: 2,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.64
      },
      day7: {
        hunkSurvival: 0.71,
        postMergeChurn: 0.2,
        followUpTouchCount: 3,
        defectLinks: 0,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.74
      },
      day14: {
        hunkSurvival: 0.62,
        postMergeChurn: 0.28,
        followUpTouchCount: 5,
        defectLinks: 1,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.82
      },
      day30: {
        hunkSurvival: 0.57,
        postMergeChurn: 0.34,
        followUpTouchCount: 6,
        defectLinks: 1,
        hotfixLinks: 0,
        revertCount: 0,
        confidence: 0.88
      }
    }
  }
];
