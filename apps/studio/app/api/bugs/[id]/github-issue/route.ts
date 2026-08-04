import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { resolveOwnerApiUser } from "@/src/lib/owner-api-auth";
import {
  linkBugReportToGitHubIssue,
  resolveGitHubIssueConfig,
  splitGitHubRepo,
} from "@uwe/github-issues";
import {
  BUG_REPORT_SEVERITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
  createBugReportService,
  prisma,
} from "@uwe/database/server";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";

const bugIdParamSchema = z.object({ id: idSchema });

// Handler = Guard + Konfig-Prüfung + Dispatch. Issue-Text, Idempotenz und
// Metadaten-Zusammenführung leben in @uwe/github-issues
// (linkBugReportToGitHubIssue).

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) {
    return NextResponse.json(
      { error: "Nur der Owner darf GitHub-Issues aus Bug-Reports erstellen." },
      { status: 403 },
    );
  }

  const parsedParams = await parseParams(context.params, bugIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const githubConfig = resolveGitHubIssueConfig();
  if (!githubConfig.token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN oder GITHUB_ISSUE_TOKEN fehlt — siehe .env.example." },
      { status: 503 },
    );
  }
  if (!githubConfig.repo) {
    return NextResponse.json(
      { error: "GITHUB_ISSUE_REPO nicht gesetzt (Format: owner/repo) — siehe .env.example." },
      { status: 503 },
    );
  }

  const target = splitGitHubRepo(githubConfig.repo);
  if (!target) {
    return NextResponse.json(
      { error: "GITHUB_ISSUE_REPO ungültig — erwartet owner/repo." },
      { status: 503 },
    );
  }

  const bugs = createBugReportService(prisma);
  const report = await bugs.getReport(parsedParams.data.id);
  if (!report) {
    return jsonError("Bug-Report nicht gefunden.", 404);
  }

  const result = await linkBugReportToGitHubIssue(
    {
      id: report.id,
      title: report.title,
      description: report.description,
      severityLabel: BUG_REPORT_SEVERITY_LABELS[report.severity],
      statusLabel: BUG_REPORT_STATUS_LABELS[report.status],
      module: report.module,
      screenshotAssetId: report.screenshotAssetId,
      metadata: report.metadata,
    },
    target,
    githubConfig.token,
  );

  if (result.status === "already_linked") {
    return NextResponse.json(
      {
        error: "Für diesen Bug-Report ist bereits ein GitHub-Issue verknüpft.",
        githubIssueUrl: result.githubIssueUrl,
      },
      { status: 409 },
    );
  }

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const updated = await bugs.updateReport(report.id, { metadata: result.metadata });

  return NextResponse.json(
    {
      githubIssueUrl: result.githubIssueUrl,
      issueNumber: result.issueNumber,
      reportId: updated.id,
    },
    { status: 201 },
  );
}
