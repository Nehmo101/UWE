import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import {
  buildBriefingContext,
  hasBriefingContent,
  loadWeekBriefingInput,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";

/**
 * Wochenbriefing — was in dieser Woche ansteht.
 *
 * Die Übersicht entsteht ohne KI: Termine je Person, Geburtstage, fällige
 * Arzt- und Tierarzttermine, auslaufende Verträge. Es wird nichts zusätzlich
 * gespeichert — die Woche wird bei jedem Aufruf neu ausgerechnet.
 */

export const dynamic = "force-dynamic";

export default async function FamilyBriefingPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/briefing" title="Wochenbriefing">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const input = await loadWeekBriefingInput({
    familyDb: familyPrisma,
    calendar: createCalendarService(familyPrisma, prisma),
  });

  const overview = buildBriefingContext(input);
  const quiet = !hasBriefingContent(input);

  return (
    <FamilyShell
      active="/briefing"
      title="Wochenbriefing"
      eyebrow="Gemeinsamer Bereich"
      lede={
        quiet
          ? "Diese Woche steht nichts an."
          : `${input.events.length} Termin(e), ${input.anniversaries.length} Geburtstag(e), ${input.healthDue.length} Gesundheitseintrag/-einträge.`
      }
    >
      <section className="family-section">
        <h2>Diese Woche</h2>
        <pre
          className="family-card"
          style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}
        >
          {overview}
        </pre>
      </section>

      <section className="family-section">
        <h2>Woher das kommt</h2>
        <p className="family-muted">
          Alles auf dieser Seite stammt aus dem, was im Haushalt schon gepflegt ist: Kalender,
          Mitglieder, Gesundheitsakte und Verträge. Es wird nichts zusätzlich gespeichert — die
          Seite rechnet die Woche bei jedem Aufruf neu aus.
        </p>
      </section>
    </FamilyShell>
  );
}
