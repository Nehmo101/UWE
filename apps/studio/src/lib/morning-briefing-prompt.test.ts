import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMorningBriefingPrompt } from "./morning-briefing-prompt";

describe("buildMorningBriefingPrompt", () => {
  it("serializes facts and news into the prompt", () => {
    const prompt = buildMorningBriefingPrompt({
      dateLabel: "Freitag, 3. Juli 2026",
      calendarToday: [{ title: "Zahnarzt", time: "09:30", module: "Kalender" }],
      calendarThisWeek: [{ title: "DnD Session", date: "05.07.2026" }],
      nextSession: { title: "Session 12", date: "05.07.2026" },
      mail: { recentFailed: 1, pendingCount: 2 },
      contracts: { alerts: ["Vertrag X kündbar bis 15.07."], needingReview: 1 },
      prioritizedMail: {
        urgentCount: 2,
        replyNeededCount: 1,
        todayCount: 0,
        topSubjects: ["Rechnung fällig"],
      },
      household: {
        overdueCount: 1,
        soonCount: 2,
        overdueTitles: ["Rauchmelder testen"],
        expiringPantryCount: 3,
      },
      inboxCaptureCount: 3,
      workshopOpenTasks: ["Mini grundieren"],
      hardwareIssues: 0,
      systemOk: true,
      news: [{ title: "Schlagzeile A", snippet: "Kurztext" }],
    });

    assert.ok(prompt.includes("Datum: Freitag, 3. Juli 2026"));
    assert.ok(prompt.includes("Zahnarzt (Kalender, 09:30)"));
    assert.ok(prompt.includes("Nächste DnD-Session: Session 12 am 05.07.2026"));
    assert.ok(prompt.includes("Vertrag X kündbar bis 15.07."));
    assert.ok(prompt.includes("Schlagzeile A — Kurztext"));
    assert.ok(prompt.includes("Unbearbeitete Captures in der Inbox: 3"));
    assert.ok(prompt.includes("Wichtige Mails: 2 dringend, 1 Antwort nötig, 0 heute"));
    assert.ok(prompt.includes("Rauchmelder testen"));
    assert.ok(prompt.includes("priorisierte Heute-Agenda"));
  });

  it("marks empty sections instead of omitting them", () => {
    const prompt = buildMorningBriefingPrompt({
      dateLabel: "Montag",
      calendarToday: [],
      calendarThisWeek: [],
      nextSession: null,
      mail: { recentFailed: 0, pendingCount: 0 },
      contracts: { alerts: [], needingReview: 0 },
      prioritizedMail: { urgentCount: 0, replyNeededCount: 0, todayCount: 0, topSubjects: [] },
      household: { overdueCount: 0, soonCount: 0, overdueTitles: [], expiringPantryCount: 0 },
      inboxCaptureCount: 0,
      workshopOpenTasks: [],
      hardwareIssues: 0,
      systemOk: true,
      news: [],
    });

    assert.ok(prompt.includes("Termine heute: keine"));
    assert.ok(prompt.includes("News-Schlagzeilen: keine"));
    assert.ok(prompt.includes("Top-Mails: keine"));
    assert.ok(prompt.includes("Überfällige Haushaltsaufgaben: keine"));
    assert.ok(!prompt.includes("Nächste DnD-Session"));
  });
});
