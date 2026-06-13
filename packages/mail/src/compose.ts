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

export interface ShareLinkSource {
  worldId: string;
  shareLinkId: string;
  targetLabel: string;
  publicUrl: string;
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

export function composeShareLinkMail(source: ShareLinkSource): MailDraft {
  const bodyText = `${source.targetLabel}\n\nVorschau-Link: ${source.publicUrl}`;
  const bodyHtml = `<h2>${escapeHtml(source.targetLabel)}</h2>\n<p><a href="${escapeHtml(source.publicUrl)}">${escapeHtml(source.publicUrl)}</a></p>`;

  return {
    kind: "share_link",
    subject: `Vorschau: ${source.targetLabel}`,
    bodyText,
    bodyHtml,
    sourceType: "share_link",
    sourceId: source.shareLinkId,
    worldId: source.worldId,
    warnings: [],
    containsDmOnlyHint: false,
  };
}

export function composeMail(
  kind: MailComposeKind,
  source: SessionRecapSource | HandoutSource | ShareLinkSource,
): MailDraft {
  switch (kind) {
    case "session_recap":
      return composeSessionRecapMail(source as SessionRecapSource);
    case "handout":
      return composeHandoutMail(source as HandoutSource);
    case "share_link":
      return composeShareLinkMail(source as ShareLinkSource);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unbekannter Compose-Typ: ${String(_exhaustive)}`);
    }
  }
}
