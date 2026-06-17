import { useMemo, useState } from "react";
import { Effect } from "effect";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Clipboard,
  ClipboardCheck,
  Code2,
  Gauge,
  GitPullRequest,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockPullRequests } from "@/domain/mockData";
import {
  type ScoredPullRequest,
  type SurvivalWindow,
  scoreWorkspace,
  survivalWindows,
  windowLabels
} from "@/domain/survival";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

const verdictLabel: Record<ScoredPullRequest["verdict"], string> = {
  durable: "Durable",
  watch: "Watch",
  sludge: "Sludge"
};

const verdictClasses: Record<ScoredPullRequest["verdict"], string> = {
  durable: "text-emerald-700",
  watch: "text-amber-700",
  sludge: "text-rose-700"
};

const progressTone: Record<ScoredPullRequest["verdict"], string> = {
  durable: "bg-emerald-600",
  watch: "bg-amber-500",
  sludge: "bg-rose-600"
};

function App() {
  const [window, setWindow] = useState<SurvivalWindow>("day14");
  const workspace = useMemo(
    () => Effect.runSync(scoreWorkspace(mockPullRequests, window)),
    [window]
  );
  const [selectedId, setSelectedId] = useState(workspace.pullRequests[0]!.id);
  const selected =
    workspace.pullRequests.find((pr) => pr.id === selectedId) ??
    workspace.pullRequests[0]!;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
              <ShieldCheck className="size-5 text-emerald-700" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-normal">
                  Survival Receipts
                </h1>
                <Badge variant="info">Prototype</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-assisted PRs ranked by survived shipped change per dollar.
              </p>
            </div>
          </div>

          <Tabs
            value={window}
            onValueChange={(value) => setWindow(value as SurvivalWindow)}
          >
            <TabsList aria-label="Survival window">
              {survivalWindows.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {windowLabels[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Gauge aria-hidden />}
            label="Impact density"
            value={`${decimal.format(workspace.hunksPer100Dollars)} / $100`}
            detail={`${decimal.format(workspace.survivedHunks)} survived hunks`}
          />
          <MetricCard
            icon={<ShieldCheck aria-hidden />}
            label="Survival score"
            value={`${workspace.survivalScore}%`}
            detail={`${workspace.watchCount} watch, ${workspace.sludgeCount} sludge`}
          />
          <MetricCard
            icon={<BadgeDollarSign aria-hidden />}
            label="Cleanup tax"
            value={currency.format(workspace.cleanupTaxUsd)}
            detail={`${currency.format(workspace.spendUsd)} AI spend`}
          />
          <MetricCard
            icon={<Sparkles aria-hidden />}
            label="Attribution"
            value={percent.format(workspace.attributionConfidence)}
            detail={`${workspace.pullRequests.length} AI-assisted PRs`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div>
                <CardTitle>AI-assisted PRs</CardTitle>
                <CardDescription>
                  Sorted by durable semantic hunks per AI dollar.
                </CardDescription>
              </div>
              <Badge variant="outline">{windowLabels[window]} window</Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Pull request</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">AI cost</TableHead>
                    <TableHead className="min-w-[150px]">Survival</TableHead>
                    <TableHead className="text-right">Density</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.pullRequests.map((pr) => (
                    <TableRow
                      key={pr.id}
                      role="button"
                      tabIndex={0}
                      data-state={selected.id === pr.id ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(pr.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(pr.id);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-start gap-3">
                          <GitPullRequest
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">#{pr.number}</span>
                              <span className="break-words">{pr.title}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{pr.repo}</span>
                              <span>{pr.shippedSurface}</span>
                              <span>{pr.agent}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{pr.team}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {currency.format(pr.ai.costUsd)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={pr.verdict}>
                              {verdictLabel[pr.verdict]}
                            </Badge>
                            <span
                              className={cn(
                                "text-sm font-semibold tabular",
                                verdictClasses[pr.verdict]
                              )}
                            >
                              {pr.survivalScore}
                            </span>
                          </div>
                          <ScoreBar pr={pr} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular">
                        {decimal.format(pr.hunksPer100Dollars)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {currency.format(pr.cleanupTaxUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <ReceiptCard pr={selected} />
            <CleanupLeaks items={workspace.cleanupLeaks} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <TeamRollups teams={workspace.teams} />
          <EvidencePanel pr={selected} />
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tabular">
              {value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground [&_svg]:size-4">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ pr }: { pr: ScoredPullRequest }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full", progressTone[pr.verdict])}
        style={{ width: `${pr.survivalScore}%` }}
      />
    </div>
  );
}

function ReceiptCard({ pr }: { pr: ScoredPullRequest }) {
  const [copied, setCopied] = useState(false);

  const copyReceipt = async () => {
    await navigator.clipboard.writeText(pr.receiptMarkdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Receipt preview</CardTitle>
          <CardDescription>
            #{pr.number} in {pr.repo}
          </CardDescription>
        </div>
        <Badge variant={pr.verdict}>{verdictLabel[pr.verdict]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground">
            {pr.receiptMarkdown}
          </pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={copyReceipt}>
            {copied ? (
              <ClipboardCheck aria-hidden />
            ) : (
              <Clipboard aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" size="sm" variant="outline">
            <ArrowUpRight aria-hidden />
            PR #{pr.number}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CleanupLeaks({ items }: { items: ScoredPullRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cleanup leaks</CardTitle>
        <CardDescription>Largest drag against AI spend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((pr) => (
          <div key={pr.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
              <AlertTriangle
                className={cn(
                  "size-4",
                  pr.verdict === "sludge"
                    ? "text-rose-700"
                    : "text-amber-700"
                )}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="break-words text-sm font-medium">
                  #{pr.number} {pr.title}
                </p>
                <span className="shrink-0 text-sm font-semibold tabular">
                  {currency.format(pr.cleanupTaxUsd)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {pr.riskDrivers.slice(0, 3).join(", ")}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamRollups({
  teams
}: {
  teams: {
    team: string;
    spendUsd: number;
    survivedHunks: number;
    hunksPer100Dollars: number;
    cleanupTaxUsd: number;
    survivalScore: number;
    pullRequestCount: number;
  }[];
}) {
  const maxDensity = Math.max(...teams.map((team) => team.hunksPer100Dollars));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>Survived output per $100 of AI spend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teams.map((team) => (
          <div key={team.team} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{team.team}</p>
                <p className="text-xs text-muted-foreground">
                  {team.pullRequestCount} PRs, {currency.format(team.spendUsd)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular">
                  {decimal.format(team.hunksPer100Dollars)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {team.survivalScore}% survival
                </p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-sky-600"
                style={{
                  width: `${Math.max(
                    6,
                    (team.hunksPer100Dollars / maxDensity) * 100
                  )}%`
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EvidencePanel({ pr }: { pr: ScoredPullRequest }) {
  const rows = [
    {
      label: "Hunk survival",
      value: pr.evidence.hunkSurvival * 100,
      display: percent.format(pr.evidence.hunkSurvival)
    },
    {
      label: "Review drag",
      value: pr.reviewDrag * 100,
      display: percent.format(pr.reviewDrag)
    },
    {
      label: "Post-merge drag",
      value: pr.postMergeDrag * 100,
      display: percent.format(pr.postMergeDrag)
    },
    {
      label: "Attribution confidence",
      value: pr.ai.confidence * 100,
      display: percent.format(pr.ai.confidence)
    }
  ];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>
            #{pr.number} review, CI, churn, and defect signals.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Code2 className="size-4" aria-hidden />
          {pr.review.semanticHunks} hunks
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <EvidenceStat label="Review comments" value={pr.review.reviewComments} />
          <EvidenceStat label="CI failures" value={pr.review.ciFailures} />
          <EvidenceStat
            label="Follow-up edits"
            value={pr.evidence.followUpTouchCount}
          />
          <EvidenceStat label="Linked defects" value={pr.evidence.defectLinks} />
        </div>
        <Separator />
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium tabular">{row.display}</span>
              </div>
              <Progress value={row.value} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
    </div>
  );
}

export default App;
