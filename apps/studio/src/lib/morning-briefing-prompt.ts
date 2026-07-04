export interface MorningBriefingFacts {
  dateLabel: string;
  calendarToday: Array<{ title: string; time?: string | null; module: string }>;
  calendarThisWeek: Array<{ title: string; date?: string | null }>;
  nextSession: { title: string; date?: string | null } | null;
  mail: { recentFailed: number; pendingCount: number };
  contracts: { alerts: string[]; needingReview: number };
  prioritizedMail: {
    urgentCount: number;
    replyNeededCount: number;
    todayCount: number;
    topSubjects: string[];
  };
  household: {
    overdueCount: number;
    soonCount: number;
    overdueTitles: string[];
    expiringPantryCount: number;
  };
  inboxCaptureCount: number;
  workshopOpenTasks: string[];
  hardwareIssues: number;
  systemOk: boolean;
  news: Array<{ title: string; snippet: string }>;
}

function section(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return [`${title}: keine`];
  }
  return [`${title}:`, ...lines.map((line) => `- ${line}`)];
}

/** Serialize dashboard facts + news headlines into the briefing prompt. */
export function buildMorningBriefingPrompt(facts: MorningBriefingFacts): string {
  const parts: string[] = [
    "Erstelle daraus eine kurze, priorisierte Heute-Agenda: zuerst die 3–5 wichtigsten Punkte (dringende Mails, überfällige oder heute fällige Aufgaben, anstehende Termine), danach ein knapper Lagebericht. Konkret und handlungsorientiert.",
    "",
    `Datum: ${facts.dateLabel}`,
    "",
  ];

  parts.push(
    ...section(
      "Termine heute",
      facts.calendarToday.map(
        (item) => `${item.title} (${item.module}${item.time ? `, ${item.time}` : ""})`,
      ),
    ),
    ...section(
      "Diese Woche",
      facts.calendarThisWeek.map((item) =>
        item.date ? `${item.title} (${item.date})` : item.title,
      ),
    ),
  );

  if (facts.nextSession) {
    parts.push(
      `Nächste DnD-Session: ${facts.nextSession.title}${facts.nextSession.date ? ` am ${facts.nextSession.date}` : ""}`,
    );
  }

  parts.push(
    ...section("Vertrags-Warnungen", facts.contracts.alerts),
    `Verträge zur Prüfung: ${facts.contracts.needingReview}`,
    `Unbearbeitete Captures in der Inbox: ${facts.inboxCaptureCount}`,
    `Wichtige Mails: ${facts.prioritizedMail.urgentCount} dringend, ${facts.prioritizedMail.replyNeededCount} Antwort nötig, ${facts.prioritizedMail.todayCount} heute`,
    ...section("Top-Mails", facts.prioritizedMail.topSubjects),
    `Haushalt: ${facts.household.overdueCount} überfällig, ${facts.household.soonCount} bald fällig, ${facts.household.expiringPantryCount} Vorräte laufen ab`,
    ...section("Überfällige Haushaltsaufgaben", facts.household.overdueTitles),
    ...section("Offene Werkstatt-Aufgaben", facts.workshopOpenTasks),
    `Hardware mit Problemen: ${facts.hardwareIssues}`,
    `Fehlgeschlagene Mails: ${facts.mail.recentFailed}, ausstehend: ${facts.mail.pendingCount}`,
    `Systemstatus: ${facts.systemOk ? "OK" : "Einschränkungen"}`,
    "",
    ...section(
      "News-Schlagzeilen",
      facts.news.map((item) => (item.snippet ? `${item.title} — ${item.snippet}` : item.title)),
    ),
  );

  return parts.join("\n");
}
