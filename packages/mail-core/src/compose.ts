import type { MailComposeKind, MailDraft } from "./types";

export interface SessionRecapSource {
  worldId: string;
  sessionId: string;
  sessionTitle: string;
  sessionNumber: number;
  summaryPlayer: string | null;
  summaryDm: string | null;
}

export interface HandoutSource {
  worldId: string;
  assetId: string;
  title: string;
  description: string | null;
  visibility: string;
  publicUrl?: string;
}

export interface SessionReminderSource {
  worldId: string;
  sessionId: string;
  sessionTitle: string;
  sessionNumber: number;
  sessionDate: string;
}

export interface ContractReminderSource {
  contractId: string;
  contractName: string;
  reminderMessage: string;
  dueDate: string;
}

export interface BackupWarningSource {
  message: string;
  lastBackupAt: string;
}

export interface SystemWarningSource {
  title: string;
  message: string;
}

export interface TerrainRentalSource {
  worldId?: string | null;
  projectId: string;
  projectTitle: string;
  message: string;
  status: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function composeSessionRecapMail(source: SessionRecapSource): MailDraft {
  const warnings: string[] = [];
  const playerSummary = source.summaryPlayer?.trim() ?? "";

  if (!playerSummary) {
    warnings.push(
      "Kein Spieler-Recap vorhanden. DM-only Zusammenfassungen werden nicht automatisch übernommen.",
    );
  }

  if (source.summaryDm?.trim() && !playerSummary) {
    warnings.push("Es gibt nur eine DM-Zusammenfassung — diese wird nicht an Spieler gesendet.");
  }

  const bodyText = playerSummary
    ? `Session ${source.sessionNumber}: ${source.sessionTitle}\n\n${playerSummary}`
    : `Session ${source.sessionNumber}: ${source.sessionTitle}\n\n[Spieler-Recap noch nicht veröffentlicht]`;

  const bodyHtml = playerSummary
    ? `<h2>Session ${source.sessionNumber}: ${escapeHtml(source.sessionTitle)}</h2>\n${textToHtmlParagraphs(playerSummary)}`
    : `<h2>Session ${source.sessionNumber}: ${escapeHtml(source.sessionTitle)}</h2>\n<p><em>Spieler-Recap noch nicht veröffentlicht.</em></p>`;

  return {
    kind: "session_recap",
    subject: `Session-Recap: ${source.sessionTitle}`,
    bodyText,
    bodyHtml,
    sourceType: "game_session",
    sourceId: source.sessionId,
    worldId: source.worldId,
    warnings,
    containsDmOnlyHint: Boolean(source.summaryDm?.trim() && !playerSummary),
  };
}

export function composeHandoutMail(source: HandoutSource): MailDraft {
  const warnings: string[] = [];

  if (source.visibility === "dm_only") {
    warnings.push("Dieses Handout ist als DM-only markiert und sollte nicht an Spieler gesendet werden.");
  }

  const description = source.description?.trim() ?? "";
  const linkLine = source.publicUrl ? `\n\nLink: ${source.publicUrl}` : "";
  const bodyText = `${source.title}\n\n${description || "Handout für die Kampagne."}${linkLine}`;

  const htmlParts = [
    `<h2>${escapeHtml(source.title)}</h2>`,
    description ? textToHtmlParagraphs(description) : "<p>Handout für die Kampagne.</p>",
  ];

  if (source.publicUrl) {
    htmlParts.push(
      `<p><a href="${escapeHtml(source.publicUrl)}">Handout im Portal öffnen</a></p>`,
    );
  }

  return {
    kind: "handout",
    subject: `Handout: ${source.title}`,
    bodyText,
    bodyHtml: htmlParts.join("\n"),
    sourceType: "asset",
    sourceId: source.assetId,
    worldId: source.worldId,
    warnings,
    containsDmOnlyHint: source.visibility === "dm_only",
  };
}


export function composeSessionReminderMail(source: SessionReminderSource): MailDraft {
  const bodyText = `Session ${source.sessionNumber}: ${source.sessionTitle}\n\nTermin: ${source.sessionDate}\n\nBitte bestätige deine Teilnahme.`;
  const bodyHtml = `<h2>Session ${source.sessionNumber}: ${escapeHtml(source.sessionTitle)}</h2>\n<p>Termin: ${escapeHtml(source.sessionDate)}</p>\n<p>Bitte bestätige deine Teilnahme.</p>`;

  return {
    kind: "session_reminder",
    subject: `Session-Erinnerung: ${source.sessionTitle}`,
    bodyText,
    bodyHtml,
    sourceType: "game_session",
    sourceId: source.sessionId,
    worldId: source.worldId,
    warnings: ["Session-Erinnerungen werden nur nach manueller Freigabe versendet."],
    containsDmOnlyHint: false,
  };
}

export function composeContractReminderMail(source: ContractReminderSource): MailDraft {
  const bodyText = `${source.contractName}\n\n${source.reminderMessage}\n\nFällig: ${source.dueDate}`;
  const bodyHtml = `<h2>${escapeHtml(source.contractName)}</h2>\n<p>${escapeHtml(source.reminderMessage)}</p>\n<p>Fällig: ${escapeHtml(source.dueDate)}</p>`;

  return {
    kind: "contract_reminder",
    subject: `Vertrag: ${source.contractName}`,
    bodyText,
    bodyHtml,
    sourceType: "contract_expense",
    sourceId: source.contractId,
    worldId: "",
    warnings: ["Vertragserinnerungen enthalten keine Zahlungsdaten — nur Fristen."],
    containsDmOnlyHint: false,
  };
}

export function composeBackupWarningMail(source: BackupWarningSource): MailDraft {
  const bodyText = `Backup-Prüfung\n\n${source.message}\n\nLetztes Backup: ${source.lastBackupAt}`;
  const bodyHtml = `<h2>Backup-Prüfung</h2>\n<p>${escapeHtml(source.message)}</p>\n<p>Letztes Backup: ${escapeHtml(source.lastBackupAt)}</p>`;

  return {
    kind: "backup_warning",
    subject: "UWE Backup-Prüfung",
    bodyText,
    bodyHtml,
    sourceType: "backup",
    sourceId: "backup-check",
    worldId: "",
    warnings: ["Backup-Warnungen werden nicht automatisch versendet."],
    containsDmOnlyHint: false,
  };
}

export function composeSystemWarningMail(source: SystemWarningSource): MailDraft {
  const bodyText = `${source.title}\n\n${source.message}`;
  const bodyHtml = `<h2>${escapeHtml(source.title)}</h2>\n<p>${escapeHtml(source.message)}</p>`;

  return {
    kind: "system_warning",
    subject: `UWE Systemhinweis: ${source.title}`,
    bodyText,
    bodyHtml,
    sourceType: "system",
    sourceId: "system-warning",
    worldId: "",
    warnings: ["Systemwarnungen erfordern manuelle Prüfung vor dem Versand."],
    containsDmOnlyHint: false,
  };
}

export function composeTerrainRentalMail(source: TerrainRentalSource): MailDraft {
  const bodyText = `${source.projectTitle}\n\n${source.message}\n\nStatus: ${source.status}`;
  const bodyHtml = `<h2>${escapeHtml(source.projectTitle)}</h2>\n<p>${escapeHtml(source.message)}</p>\n<p>Status: ${escapeHtml(source.status)}</p>`;

  return {
    kind: "terrain_rental",
    subject: `Terrain-Verleih: ${source.projectTitle}`,
    bodyText,
    bodyHtml,
    sourceType: "workshop_project",
    sourceId: source.projectId,
    worldId: source.worldId ?? "",
    warnings: [],
    containsDmOnlyHint: false,
  };
}

export function composeMail(
  kind: MailComposeKind,
  source:
    | SessionRecapSource
    | HandoutSource
    | SessionReminderSource
    | ContractReminderSource
    | BackupWarningSource
    | SystemWarningSource
    | TerrainRentalSource,
): MailDraft {
  switch (kind) {
    case "session_recap":
      return composeSessionRecapMail(source as SessionRecapSource);
    case "session_reminder":
      return composeSessionReminderMail(source as SessionReminderSource);
    case "handout":
      return composeHandoutMail(source as HandoutSource);
    case "contract_reminder":
      return composeContractReminderMail(source as ContractReminderSource);
    case "backup_warning":
      return composeBackupWarningMail(source as BackupWarningSource);
    case "system_warning":
      return composeSystemWarningMail(source as SystemWarningSource);
    case "terrain_rental":
      return composeTerrainRentalMail(source as TerrainRentalSource);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unbekannter Compose-Typ: ${String(_exhaustive)}`);
    }
  }
}
