import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { createFamilyService } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyMemberService } from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";

/**
 * Start — was heute in der Family ansteht.
 *
 * Noch schmal: Verträge, Dokumente und Kalender liegen bis zum Umzug der 14
 * Bestandsmodelle in der Brain-DB (siehe Schritt 7a). Was hier steht, kommt
 * bereits aus `uwe-family.db`.
 */

export const dynamic = "force-dynamic";

export default async function FamilyStartPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/" title="Family">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const service = createFamilyService(familyPrisma);
  const memberService = createFamilyMemberService(familyPrisma);
  await memberService.ensureMemberForUser({ userId: user.id, displayName: user.displayName });

  const [conversations, sharedFacts, privateFacts, members] = await Promise.all([
    service.listConversations(user.id),
    service.listFacts(user.id, "shared"),
    service.listFacts(user.id, "private"),
    memberService.listMembers(),
  ]);

  return (
    <FamilyShell
      active="/"
      title="Family"
      eyebrow="Gemeinsamer Bereich"
      lede={`Hallo ${user.displayName}. Was hier steht, sehen alle mit dem Häkchen Family — ausser deinem privaten Chat.`}
    >
      <div className="family-kpis">
        <Link className="family-kpi" href="/chat">
          <strong>{conversations.filter((entry) => entry.scope === "shared").length}</strong>
          <span>Gemeinsame Unterhaltungen</span>
        </Link>
        <Link className="family-kpi" href="/chat/privat">
          <strong>{conversations.filter((entry) => entry.scope === "private").length}</strong>
          <span>Deine privaten Unterhaltungen</span>
        </Link>
        <Link className="family-kpi" href="/chat">
          <strong>{sharedFacts.length}</strong>
          <span>Family-Wissen</span>
        </Link>
        <Link className="family-kpi" href="/chat/privat">
          <strong>{privateFacts.length}</strong>
          <span>Dein privates Wissen</span>
        </Link>
        <Link className="family-kpi" href="/members">
          <strong>{members.length}</strong>
          <span>Mitglieder</span>
        </Link>
      </div>

      <section className="family-section">
        <h2>Zuletzt gesprochen</h2>
        {conversations.length === 0 ? (
          // Der Leerzustand ist hier das Erste, was ein neues Mitglied sieht —
          // er bekommt deshalb die gemeinsame Form aus `design-v3/states.css`
          // statt eines grauen Satzes am Seitenrand.
          <EmptyState
            icon="✎"
            title="Noch nichts gesprochen"
            description="Was im Family-Chat hängen bleibt, landet danach hier und im Family-Wissen."
            action={
              <Link className="family-btn" href="/chat">
                Zum Family-Chat
              </Link>
            }
          />
        ) : (
          <ul className="family-list">
            {conversations.slice(0, 8).map((conversation) => (
              <li key={conversation.id} className="family-row">
                <div className="family-row-head">
                  <strong>
                    <Link
                      href={conversation.scope === "shared" ? "/chat" : "/chat/privat"}
                    >
                      {conversation.title}
                    </Link>
                  </strong>
                  <span className="family-tag">
                    {conversation.scope === "shared" ? "gemeinsam" : "privat"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="family-section">
        <h2>Noch nicht hier</h2>
        <p className="family-muted">
          Verträge, Dokumente und der Familien-Kalender ziehen mit ihren Daten aus der Brain-DB
          hierher um. Bis dahin stehen sie noch dort.
        </p>
      </section>
    </FamilyShell>
  );
}
