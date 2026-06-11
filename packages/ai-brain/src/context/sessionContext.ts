import type { UweRepository } from "@uwe/database/server";
import type { AiContextSession } from "../types";

export function serializeSession(
  session: AiContextSession,
  options: { allowDmOnly: boolean },
): string {
  const lines = [
    `# Session: ${session.title} (${session.sessionId})`,
    `Nummer: ${session.sessionNumber}`,
    `Status: ${session.status}`,
  ];

  if (session.date) {
    lines.push(`Datum: ${session.date}`);
  }

  if (options.allowDmOnly) {
    if (session.summaryDm) lines.push(`DM-Zusammenfassung: ${session.summaryDm}`);
    if (session.notes) lines.push(`DM-Notizen: ${session.notes}`);
    if (session.openPlots) lines.push(`Offene Plots (DM): ${session.openPlots}`);
    if (session.playerDecisions) lines.push(`Spielerentscheidungen: ${session.playerDecisions}`);
  }

  if (session.summaryPlayer) {
    lines.push(`Spieler-Recap (bisher): ${session.summaryPlayer}`);
  }

  if (session.linkedPageIds.length > 0) {
    lines.push(`Verknüpfte Seiten: ${session.linkedPageIds.join(", ")}`);
  }

  return lines.join("\n");
}

export async function loadSessionContext(
  repo: UweRepository,
  sessionId: string,
  options: { allowDmOnly: boolean },
): Promise<AiContextSession | null> {
  const session = await repo.getGameSessionById(sessionId);
  if (!session) return null;

  return {
    sessionId: session.id,
    title: session.title,
    sessionNumber: session.sessionNumber,
    date: session.date?.toISOString().slice(0, 10) ?? null,
    status: session.status,
    summaryDm: options.allowDmOnly ? session.summaryDm : null,
    summaryPlayer: session.summaryPlayer,
    notes: options.allowDmOnly ? session.notes : null,
    openPlots: options.allowDmOnly ? session.openPlots : null,
    playerDecisions: options.allowDmOnly ? session.playerDecisions : null,
    linkedPageIds: session.linkedPages.map((link) => link.pageId),
  };
}
