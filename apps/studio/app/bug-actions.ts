"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BugReportSeverityEnum,
  BugReportStatusEnum,
  createBugReportService,
  prisma,
  type BugReportSeverity,
  type BugReportStatus,
} from "@uwe/database/server";
import { getCurrentAuthUser } from "@/src/lib/auth";

function bugs() {
  return createBugReportService(prisma);
}

function parseStatus(value: FormDataEntryValue | null): BugReportStatus | undefined {
  const candidate = String(value ?? "");
  return (Object.values(BugReportStatusEnum) as readonly string[]).includes(candidate)
    ? (candidate as BugReportStatus)
    : undefined;
}

function parseSeverity(value: FormDataEntryValue | null): BugReportSeverity | undefined {
  const candidate = String(value ?? "");
  return (Object.values(BugReportSeverityEnum) as readonly string[]).includes(candidate)
    ? (candidate as BugReportSeverity)
    : undefined;
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseGithubIssueUrl(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/.test(trimmed)) {
    throw new Error("GitHub-Issue-URL muss https://github.com/owner/repo/issues/123 sein.");
  }
  return trimmed;
}

function buildRedirectPath(
  bugId?: string,
  filters?: { status?: string | null; severity?: string | null },
): string {
  const params = new URLSearchParams();
  if (bugId) {
    params.set("bug", bugId);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.severity) {
    params.set("severity", filters.severity);
  }
  const query = params.toString();
  return query.length > 0 ? `/bugs?${query}` : "/bugs";
}

function readFilters(formData: FormData) {
  return {
    status: String(formData.get("filterStatus") ?? "").trim() || null,
    severity: String(formData.get("filterSeverity") ?? "").trim() || null,
  };
}

export async function createBugReportAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    throw new Error("Titel ist erforderlich.");
  }

  const user = await getCurrentAuthUser();
  const filters = readFilters(formData);

  const githubIssueUrl = parseGithubIssueUrl(formData.get("githubIssueUrl"));

  const report = await bugs().createReport({
    title,
    description: String(formData.get("description") ?? ""),
    severity: parseSeverity(formData.get("severity")) ?? "medium",
    module: parseOptionalText(formData.get("module")),
    screenshotAssetId: parseOptionalText(formData.get("screenshotAssetId")),
    reporterUserId: user?.id ?? null,
    metadata: githubIssueUrl ? { githubIssueUrl } : null,
  });

  revalidatePath("/bugs");
  redirect(buildRedirectPath(report.id, filters));
}

export async function updateBugReportAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Bug-ID fehlt.");
  }

  const filters = readFilters(formData);
  const githubIssueUrl = parseGithubIssueUrl(formData.get("githubIssueUrl"));

  await bugs().updateReport(id, {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? ""),
    severity: parseSeverity(formData.get("severity")),
    module: parseOptionalText(formData.get("module")),
    screenshotAssetId: parseOptionalText(formData.get("screenshotAssetId")),
    metadata: { githubIssueUrl },
  });

  revalidatePath("/bugs");
  redirect(buildRedirectPath(id, filters));
}

export async function updateBugReportStatusAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const id = String(formData.get("id") ?? "");
  const status = parseStatus(formData.get("status"));
  if (!id || !status) {
    throw new Error("Bug-ID und gültiger Status sind erforderlich.");
  }

  const filters = readFilters(formData);

  await bugs().updateStatus(id, status);

  revalidatePath("/bugs");
  redirect(buildRedirectPath(id, filters));
}

export async function updateBugReportSeverityAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const id = String(formData.get("id") ?? "");
  const severity = parseSeverity(formData.get("severity"));
  if (!id || !severity) {
    throw new Error("Bug-ID und gültiger Schweregrad sind erforderlich.");
  }

  const filters = readFilters(formData);

  await bugs().updateReport(id, { severity });

  revalidatePath("/bugs");
  redirect(buildRedirectPath(id, filters));
}

export async function deleteBugReportAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Bug-ID fehlt.");
  }

  const filters = readFilters(formData);

  await bugs().deleteReport(id);

  revalidatePath("/bugs");
  redirect(buildRedirectPath(undefined, filters));
}
