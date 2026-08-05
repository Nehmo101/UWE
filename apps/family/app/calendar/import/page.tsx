import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyMemberService, resolveMemberColour } from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { IcsImport, type IcsImportMember } from "@/src/components/calendar/IcsImport";

/**
 * ICS-Datei importieren — die einmalige Übernahme.
 *
 * Der Unterschied zu „Fremde Kalender" steht bewusst auf der Seite: ein Abo
 * bleibt fremd und wird laufend abgeglichen, ein Import gehört danach dem
 * Haushalt. Wer eine Einladung aus der Mail oder den Ferienplan als Datei
 * bekommt, will das zweite.
 */

export const dynamic = "force-dynamic";

export default async function FamilyCalendarImportPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/calendar" title="Kalender-Import">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const memberRows = await createFamilyMemberService(familyPrisma).listMembers();
  const members: IcsImportMember[] = memberRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    colour: resolveMemberColour(row),
  }));

  return (
    <FamilyShell
      active="/calendar"
      title="Kalender-Import"
      eyebrow="Gemeinsamer Bereich"
      lede="Eine ICS-Datei einlesen — aus der Mail, vom Ferienplan, aus einem anderen Kalender. Erst die Vorschau, dann die Übernahme."
    >
      <section className="family-section">
        <h2>Datei einlesen</h2>
        <IcsImport members={members} />
      </section>

      <section className="family-section">
        <h2>Import oder Abo?</h2>
        <p className="family-muted">
          Ein <strong>Import</strong> ist einmalig: die Termine gehören danach dem Haushalt, sind
          änderbar und löschbar und stehen im{" "}
          <Link href="/calendar/abo">Kalender-Abo</Link> aufs Handy. Ändert sich die Quelle,
          bekommt UWE davon nichts mit — dieselbe Datei lässt sich aber jederzeit erneut
          einlesen, ohne dass alles doppelt im Kalender steht.
        </p>
        <p className="family-muted">
          Ein <Link href="/calendar/feeds">Abo</Link> dagegen bleibt fremd und wird laufend
          abgeglichen. Für Schule, Verein oder Arbeit ist das der richtige Weg — eine Änderung
          von Hand würde dort beim nächsten Abgleich überschrieben.
        </p>
        <p className="family-muted">
          Serientermine (jeden Montag, jede zweite Woche) übernimmt der Import als einzelnen
          Termin — die Vorschau sagt es dazu. Wiederkehrendes gehört ins Abo oder in den{" "}
          <Link href="/household">Haushalt</Link>.
        </p>
      </section>
    </FamilyShell>
  );
}
