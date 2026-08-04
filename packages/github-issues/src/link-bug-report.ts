import { createGitHubIssue } from "./create-issue";

/**
 * Verknüpft einen Bug-Report mit einem GitHub-Issue — Idempotenz, Issue-Text
 * und Metadaten-Zusammenführung in einem Aufruf.
 *
 * Die Persistenz bleibt beim Aufrufer (der Bug-Report-Service gehört zu
 * packages/database, und dieses Paket soll schmal bleiben): bei `created`
 * schreibt der Aufrufer `result.metadata` zurück in den Report.
 */
export interface BugReportForIssue {
  id: string;
  title: string;
  description: string;
  /** Anzeige-Labels — kommen vom Aufrufer, damit dieses Paket keine DB kennt. */
  severityLabel: string;
  statusLabel: string;
  module: string | null;
  screenshotAssetId: string | null;
  metadata: unknown;
}

export type LinkBugReportResult =
  | { status: "already_linked"; githubIssueUrl: string }
  | {
      status: "created";
      githubIssueUrl: string;
      issueNumber: number | null;
      /** Report-Metadaten inklusive der neuen Issue-URL — zum Zurückschreiben. */
      metadata: Record<string, unknown>;
    }
  | { status: "failed"; error: string };

export function githubIssueFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const url = (metadata as { githubIssueUrl?: unknown }).githubIssueUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function mergeGithubIssueMetadata(
  metadata: unknown,
  githubIssueUrl: string,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, githubIssueUrl };
}

export function buildIssueBody(report: BugReportForIssue): string {
  const lines = [
    report.description.trim() || "_Keine Beschreibung._",
    "",
    "---",
    `**UWE Bug-Report:** \`${report.id}\``,
    `**Status:** ${report.statusLabel}`,
    `**Schweregrad:** ${report.severityLabel}`,
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

export async function linkBugReportToGitHubIssue(
  report: BugReportForIssue,
  target: { owner: string; name: string },
  token: string,
): Promise<LinkBugReportResult> {
  // Idempotenz: Ein Report bekommt genau ein Issue — der zweite Klick liefert
  // die bestehende URL statt eines Duplikats.
  const existingUrl = githubIssueFromMetadata(report.metadata);
  if (existingUrl) {
    return { status: "already_linked", githubIssueUrl: existingUrl };
  }

  const issueResult = await createGitHubIssue(target.owner, target.name, token, {
    title: `[Bug] ${report.title}`,
    body: buildIssueBody(report),
    labels: ["bug"],
  });

  if (!issueResult.success || !issueResult.issueUrl) {
    return {
      status: "failed",
      error: issueResult.error ?? "GitHub-Issue konnte nicht erstellt werden.",
    };
  }

  return {
    status: "created",
    githubIssueUrl: issueResult.issueUrl,
    issueNumber: issueResult.issueNumber ?? null,
    metadata: mergeGithubIssueMetadata(report.metadata, issueResult.issueUrl),
  };
}
