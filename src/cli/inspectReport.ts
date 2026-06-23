import type { InspectResult } from "./inspect";

const escapeCell = (value: string) => value.replaceAll("|", "\\|");

const dateOnly = (isoDate: string) => isoDate.slice(0, 10);

const renderContributorTable = (result: InspectResult) => {
  if (result.contributors.length === 0) {
    return "No contributors found in this window.\n";
  }

  return [
    "| Name | Email | GitHub usernames | Commits | Detected PRs |",
    "| --- | --- | --- | ---: | --- |",
    ...result.contributors.map((contributor) =>
      `| ${[
        escapeCell(contributor.name),
        escapeCell(contributor.email),
        contributor.githubUsernames.length > 0
          ? contributor.githubUsernames.map(escapeCell).join(", ")
          : "",
        String(contributor.commits),
        contributor.prs.map((number) => `#${number}`).join(", ")
      ].join(" | ")} |`
    )
  ].join("\n");
};

const renderPullRequestTable = (result: InspectResult) => {
  if (result.pullRequests.length === 0) {
    return "No PR numbers found in this window.\n";
  }

  return [
    "| PR | Title | Commits | Authors | First commit | Last commit |",
    "| ---: | --- | ---: | --- | --- | --- |",
    ...result.pullRequests.map((pr) =>
      `| ${[
        `#${pr.number}`,
        escapeCell(pr.title),
        String(pr.commits),
        pr.authors.map(escapeCell).join(", "),
        dateOnly(pr.firstCommitAt),
        dateOnly(pr.lastCommitAt)
      ].join(" | ")} |`
    )
  ].join("\n");
};

export const renderInspectReport = (result: InspectResult) =>
  [
    `# Repository inspection: ${result.repoName}`,
    "",
    `Generated at: ${result.generatedAt}`,
    "",
    "## Window",
    "",
    `- Repo: ${result.repoRoot}`,
    `- HEAD: ${result.headSha.slice(0, 12)}`,
    `- As of: ${result.asOf}`,
    `- Survival days: ${result.survivalDays.join(", ")}`,
    `- Window days: ${result.windowDays}`,
    `- Mature change window: ${result.changeWindowStart} to ${result.changeWindowEnd}`,
    `- Commit limit: ${result.limit}`,
    `- Commits seen: ${result.commitsSeen}`,
    `- Unique contributors: ${result.contributors.length}`,
    `- Detected PRs: ${result.pullRequests.length}`,
    "",
    "## Contributors",
    "",
    renderContributorTable(result),
    "",
    "## Detected PRs",
    "",
    renderPullRequestTable(result),
    ""
  ].join("\n");
