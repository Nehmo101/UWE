import Link from "next/link";
import {
  BugReportSeverityEnum,
  BugReportStatusEnum,
  createBugReportService,
  prisma,
  type BugReportSeverity,
  type BugReportStatus,
} from "@uwe/database/server";
import { resolveGitHubIssueConfig } from "@uwe/github-issues";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { getCurrentAuthUser, requireStudioAccess } from "@/src/lib/auth";
import { BugWorkspaceClient, type BugReportDto } from "./BugWorkspaceClient";

interface BugsPageProps {
  searchParams: Promise<{ bug?: string; status?: string; severity?: string }>;
}

function parseStatus(value: string | undefined): BugReportStatus | undefined {
  if (!value) return undefined;
  return (Object.values(BugReportStatusEnum) as readonly string[]).includes(value)
    ? (value as BugReportStatus)
    : undefined;
}

function parseSeverity(value: string | undefined): BugReportSeverity | undefined {
  if (!value) return undefined;
  return (Object.values(BugReportSeverityEnum) as readonly string[]).includes(value)
    ? (value as BugReportSeverity)
    : undefined;
}

function githubIssueFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const url = (metadata as { githubIssueUrl?: unknown }).githubIssueUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function toDto(row: {
  id: string;
  title: string;
  description: string;
  status: BugReportStatus;
  severity: BugReportSeverity;
  module: string | null;
  screenshotAssetId: string | null;
  reporterUserId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): BugReportDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    severity: row.severity,
    module: row.module,
    screenshotAssetId: row.screenshotAssetId,
    reporterUserId: row.reporterUserId,
    githubIssueUrl: githubIssueFromMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default async function BugsPage({ searchParams }: BugsPageProps) {
  await requireStudioAccess();
  const { bug: selectedParam, status: statusParam, severity: severityParam } = await searchParams;

  const statusFilter = parseStatus(statusParam);
  const severityFilter = parseSeverity(severityParam);

  const bugService = createBugReportService(prisma);
  const reportRows = await bugService.listReports({
    status: statusFilter,
    severity: severityFilter,
    limit: 200,
  });

  const reports: BugReportDto[] = reportRows.map(toDto);

  const user = await getCurrentAuthUser();
  const githubIssueConfig = resolveGitHubIssueConfig();
  const githubIssueSync = {
    canCreate: user?.isOwner === true,
    tokenConfigured: Boolean(githubIssueConfig.token),
    githubRepo: githubIssueConfig.repo,
  };

  return (
    <>
      <ShellBreadcrumb items={[{ label: "Bug-Center" }]} />
      <PageHeader
        title="Bug-Center"
        summary="Fehler melden, priorisieren und den Bearbeitungsstand verfolgen — Studio-intern, nicht im Portal."
      />
      <BugWorkspaceClient
        reports={reports}
        initialSelectedId={selectedParam ?? reports[0]?.id ?? null}
        filterStatus={statusFilter}
        filterSeverity={severityFilter}
        githubIssueSync={githubIssueSync}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/worlds">← Welten</Link>
      </p>
    </>
  );
}
