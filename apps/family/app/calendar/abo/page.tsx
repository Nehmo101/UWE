import { familyPrisma } from "@uwe/database/family-client";
import {
  createFamilyCalDavAccountService,
  createFamilyCalendarSubscriptionService,
  createFamilyMemberService,
  resolveMemberColour,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { SubscriptionManager } from "@/src/components/calendar/SubscriptionManager";
import { CalDavAccountManager } from "@/src/components/calendar/CalDavAccountManager";

/**
 * Kalender-Abo — den Haushalts-Kalender auf dem Handy abonnieren.
 *
 * Zwei Wege aufs Handy:
 * 1. Abo (ICS): eine URL mit eigenem, nur lesendem Token. Zeigt Termine,
 *    Geburtstage und fällige Einträge der Gesundheitsakte; ein auf Personen
 *    eingeschränktes Abo zeigt nur deren Termine plus die des ganzen
 *    Haushalts. Die Einschränkung darf mehrere Personen umfassen — ein Tablet
 *    für beide Kinder ist ein Abo, nicht zwei.
 * 2. CalDAV-Account: lesen UND schreiben — Termine auf dem iPhone anlegen,
 *    ändern und löschen. Haushalts-Zugang mit eigenem Token als Passwort.
 */

export const dynamic = "force-dynamic";

export default async function FamilyCalendarSubscriptionPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/calendar" title="Kalender-Abo">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const [subscriptions, members, calDavAccounts] = await Promise.all([
    createFamilyCalendarSubscriptionService(familyPrisma).listSubscriptions(),
    createFamilyMemberService(familyPrisma).listMembers(),
    createFamilyCalDavAccountService(familyPrisma).listAccounts(),
  ]);

  // Die öffentliche Adresse steht in der Umgebung — auf dem Handy muss die URL
  // von aussen erreichbar sein, `localhost` hilft dort nicht.
  const baseUrl =
    process.env["NEXT_PUBLIC_FAMILY_URL"]?.replace(/\/$/, "") ?? "http://localhost:3004";

  return (
    <FamilyShell
      active="/calendar"
      title="Kalender-Abo"
      eyebrow="Gemeinsamer Bereich"
      lede="Hol dir den Haushalts-Kalender in die Kalender-App auf dem Handy. Jedes Gerät bekommt eine eigene Adresse, die du einzeln widerrufen kannst."
    >
      <section className="family-section">
        <h2>Neues Abo</h2>
        <SubscriptionManager
          initial={subscriptions.map((row) => ({
            id: row.id,
            label: row.label,
            tokenPrefix: row.tokenPrefix,
            members: row.members,
            isActive: row.isActive,
            lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
          }))}
          members={members.map((member) => ({
            id: member.id,
            displayName: member.displayName,
            colour: resolveMemberColour(member),
          }))}
          baseUrl={baseUrl}
        />
      </section>

      <section className="family-section">
        <h2>Was im Abo landet</h2>
        <ul className="family-list">
          <li className="family-row">Alle Termine des Haushalts — ein Jahr zurück, zwei nach vorn.</li>
          <li className="family-row">Geburtstage und Jahrestage, jedes Jahr automatisch.</li>
          <li className="family-row">Fällige Einträge aus der Gesundheits- und Tierarzt-Akte.</li>
        </ul>
        <p className="family-muted">
          Das Abo kann nur lesen. Es kommt an keinen Chat, keine Dokumente und keine Verträge heran —
          und es kann nichts ändern. Wer die Adresse verliert, widerruft das Abo und legt ein neues an.
        </p>
      </section>

      <section className="family-section">
        <h2>iPhone-Kalender (CalDAV, lesen &amp; schreiben)</h2>
        <p className="family-muted">
          Ein CalDAV-Account macht den Haushalts-Kalender auf dem iPhone beschreibbar: Termine
          anlegen, ändern und löschen — direkt in der Kalender-App, für den ganzen Haushalt. Das
          Token ist das Account-Passwort und lässt sich einzeln widerrufen. Tipp: wer Abo und
          CalDAV-Account auf demselben Gerät nutzt, sieht Termine doppelt — dann im Abo-Kalender
          die Terminanzeige ausblenden oder nur einen der beiden Wege verwenden.
        </p>
        <CalDavAccountManager
          initial={calDavAccounts.map((row) => ({
            id: row.id,
            label: row.label,
            tokenPrefix: row.tokenPrefix,
            isActive: row.isActive,
            lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
          }))}
          serverHost={baseUrl.replace(/^https?:\/\//, "")}
        />
      </section>
    </FamilyShell>
  );
}
