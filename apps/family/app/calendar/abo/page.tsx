import { familyPrisma } from "@uwe/database/family-client";
import {
  createFamilyCalendarSubscriptionService,
  createFamilyMemberService,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { SubscriptionManager } from "@/src/components/calendar/SubscriptionManager";

/**
 * Kalender-Abo — den Haushalts-Kalender auf dem Handy abonnieren.
 *
 * Ein Abo ist eine URL mit einem eigenen, nur lesenden Token. Sie zeigt
 * Termine, Geburtstage und fällige Einträge der Gesundheitsakte; ein an eine
 * Person gebundenes Abo zeigt nur deren Termine plus die des ganzen Haushalts.
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

  const [subscriptions, members] = await Promise.all([
    createFamilyCalendarSubscriptionService(familyPrisma).listSubscriptions(),
    createFamilyMemberService(familyPrisma).listMembers(),
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
            member: row.member,
            isActive: row.isActive,
            lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
          }))}
          members={members.map((member) => ({
            id: member.id,
            displayName: member.displayName,
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
    </FamilyShell>
  );
}
