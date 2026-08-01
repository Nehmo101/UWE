import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { resolveOwnerApiUser } from "@/src/lib/owner-api-auth";
import {
  createGitHubIssue,
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

function githubIssueFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const url = (metadata as { githubIssueUrl?: unknown }).githubIssueUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function mergeGithubIssueMetadata(metadata: unknown, githubIssueUrl: string): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, githubIssueUrl };
}

function buildIssueBody(report: {
  id: string;
  description: string;
  severity: keyof typeof BUG_REPORT_SEVERITY_LABELS;
  status: keyof typeof BUG_REPORT_STATUS_LABELS;
  module: string | null;
  screenshotAssetId: string | null;
}): string {
  const lines = [
    report.description.trim() || "_Keine Beschreibung._",
    "",
    "---",
    `**UWE Bug-Report:** \`${report.id}\``,
    `**Status:** ${BUG_REPORT_STATUS_LABELS[report.status]}`,
    `**Schweregrad:** ${BUG_REPORT_SEVERITY_LABELS[report.severity]}`,
  ];

  if (report.module) {
    lines.push(`**Modul:** ${report.module}`);
  }

  if (report.screenshotAssetId) {
    lines.push(`**Screenshot-Asset:** \`${report.screenshotAssetId}\``);
  }

  lines.push("", "_Erstellt aus UWE Studio Bug-Center._");
  return lines.join("\n");
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await guardStudioApiMutation(request);
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
      {
        error: "GITHUB_TOKEN oder GITHUB_ISSUE_TOKEN fehlt — siehe .env.example.",
      },
      { status: 503 },
    );
  }
  if (!githubConfig.repo) {
    return NextResponse.json(
      {
        error: "GITHUB_ISSUE_REPO nicht gesetzt (Format: owner/repo) — siehe .env.example.",
      },
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

  const existingUrl = githubIssueFromMetadata(report.metadata);
  if (existingUrl) {
    return NextResponse.json(
      { error: "Für diesen Bug-Report ist bereits ein GitHub-Issue verknüpft.", githubIssueUrl: existingUrl },
      { status: 409 },
    );
  }

  const issueResult = await createGitHubIssue(target.owner, target.name, githubConfig.token, {
    title: `[Bug] ${report.title}`,
    body: buildIssueBody(report),
    labels: ["bug"],
  });

  if (!issueResult.success || !issueResult.issueUrl) {
    return NextResponse.json(
      { error: issueResult.error ?? "GitHub-Issue konnte nicht erstellt werden." },
      { status: 502 },
    );
  }

  const updated = await bugs.updateReport(report.id, {
    metadata: mergeGithubIssueMetadata(report.metadata, issueResult.issueUrl),
  });

  return NextResponse.json(
    {
      githubIssueUrl: issueResult.issueUrl,
      issueNumber: issueResult.issueNumber ?? null,
      reportId: updated.id,
    },
    { status: 201 },
  );
}
