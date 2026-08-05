import type { CampaignOverview } from "./cockpit-service";

/*
 * Kompakt-Digest der Kampagne für die beiden KI-Aktionen des Cockpits
 * (campaign_chapter_draft, campaign_session_hooks). Pure Serialisierung des
 * CampaignOverview — Titel, Status und Kurzfassungen, KEINE vollen
 * Kapiteltexte: lokale Modelle antworten auf kuratierten kleinen Kontext
 * besser, und das Router-Budget bleibt weit unterschritten.
 *
 * ACHTUNG Privacy: der Digest enthält DM-Material (Fraktions-Agenden, die
 * Chronik bevorzugt summaryDm). Er darf NUR in Aktionen fließen, die
 * playerSafe: false tragen — nie in Spieler-Handouts oder Recaps.
 */

const MAX_EVENTS = 10;
const MAX_QUESTS = 20;

const PREP_LABELS: Record<string, string> = {
  unprepared: "unvorbereitet",
  ready: "bereit",
  played: "gespielt",
  skipped: "übersprungen",
};

export function buildCampaignAiDigest(overview: CampaignOverview): string {
  const lines: string[] = [];
  const { campaign } = overview;

  lines.push("# Kampagnen-Cockpit (Digest)");
  lines.push(`Kampagne: ${campaign.name}`);
  if (campaign.description?.trim()) {
    lines.push(`Beschreibung: ${campaign.description.trim()}`);
  }
  if (overview.progress.label) {
    lines.push(`Fortschritt: ${overview.progress.label}`);
  }

  lines.push("");
  lines.push("## Kapitel (Lesereihenfolge)");
  if (overview.chapters.length === 0) {
    lines.push("- noch keine Kapitel");
  }
  overview.chapters.forEach((chapter, index) => {
    const status = chapter.prepStatus ? PREP_LABELS[chapter.prepStatus] ?? chapter.prepStatus : "ohne Status";
    const quests =
      chapter.questCounts.total > 0
        ? ` · Quests: ${chapter.questCounts.open} offen, ${chapter.questCounts.completed} erledigt${
            chapter.questCounts.failed > 0 ? `, ${chapter.questCounts.failed} gescheitert` : ""
          }`
        : "";
    const summary = chapter.summary?.trim() ? ` — ${chapter.summary.trim()}` : "";
    lines.push(`${index + 1}. ${chapter.title} [${status}]${quests}${summary}`);
  });

  const openQuests = [
    ...overview.unassignedQuests.filter((quest) => quest.status === "open"),
  ].map((quest) => `- ${quest.title} (ohne Kapitel)`);
  lines.push("");
  lines.push("## Offene Quests");
  if (openQuests.length === 0 && overview.chapters.every((c) => c.questCounts.open === 0)) {
    lines.push("- keine offenen Quests");
  } else {
    lines.push(...openQuests.slice(0, MAX_QUESTS));
    if (openQuests.length > MAX_QUESTS) {
      lines.push(`- … und ${openQuests.length - MAX_QUESTS} weitere`);
    }
    const chaptersWithOpen = overview.chapters.filter((c) => c.questCounts.open > 0);
    for (const chapter of chaptersWithOpen) {
      lines.push(`- ${chapter.questCounts.open} offene Quest(s) im Kapitel „${chapter.title}“`);
    }
  }

  lines.push("");
  lines.push("## Fraktionen (DM-Sicht)");
  if (overview.factions.length === 0) {
    lines.push("- keine Fraktionen mit Zustand");
  }
  for (const faction of overview.factions) {
    const power = faction.powerLevel != null ? ` [Macht ${faction.powerLevel}]` : "";
    const agenda = faction.agenda?.trim() ? ` — Agenda: ${faction.agenda.trim()}` : "";
    lines.push(`- ${faction.title}${power}${agenda}`);
  }

  lines.push("");
  lines.push("## Sessions");
  lines.push(
    overview.lastSession
      ? `Zuletzt gespielt: Session ${overview.lastSession.sessionNumber} „${overview.lastSession.title}“`
      : "Zuletzt gespielt: noch keine",
  );
  lines.push(
    overview.nextSession
      ? `Als Nächstes geplant: Session ${overview.nextSession.sessionNumber} „${overview.nextSession.title}“`
      : "Als Nächstes geplant: keine geplante Session",
  );

  lines.push("");
  lines.push("## Jüngste Chronik (Weltzeit, neueste zuerst)");
  const events = overview.recentEvents.slice(0, MAX_EVENTS);
  if (events.length === 0) {
    lines.push("- noch keine Ereignisse");
  }
  for (const event of events) {
    const summary = event.summary?.trim() ? ` — ${event.summary.trim()}` : "";
    lines.push(`- ${event.dateLabel}: ${event.title}${summary}`);
  }

  return `${lines.join("\n").trim()}\n`;
}
