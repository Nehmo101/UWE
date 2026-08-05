import Link from "next/link";
import { EmptyState, dayIndex } from "@uwe/shared-ui";
import { createCalendarService, prisma } from "@uwe/database/server";
import { createFamilyService } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createFamilyMemberService,
  loadUpcomingCalendarEntries,
  type UpcomingCalendarEntry,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { MemberDot } from "@/src/components/members/MemberFields";

/**
 * Start — was in der Family ansteht: die nächsten Termine (samt Geburtstagen),
 * dazu Chat und Wissen. Die Kalenderpflege bleibt unter `/calendar`.
 */

export const dynamic = "force-dynamic";

/** Wie weit die Startseite nach vorn schaut und wie viele Zeilen sie zeigt. */
const UPCOMING_DAYS = 7;
const UPCOMING_SHOWN = 6;

function formatWhen(entry: UpcomingCalendarEntry): string {
  return entry.startAt.toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(entry.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
    // Jahrestage liegen auf UTC-Mitternacht — Ortszeit würde den Tag verschieben.
    ...(entry.anniversary ? { timeZone: "UTC" } : {}),
  });
}

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

  const calendar = createCalendarService(familyPrisma, prisma);
  const [conversations, sharedFacts, privateFacts, members, upcoming] = await Promise.all([
    service.listConversations(user.id),
    service.listFacts(user.id, "shared"),
    service.listFacts(user.id, "private"),
    memberService.listMembers(),
    loadUpcomingCalendarEntries({ familyDb: familyPrisma, calendar, days: UPCOMING_DAYS }),
  ]);

  return (
    <FamilyShell
      active="/"
      title="Family"
      eyebrow="Gemeinsamer Bereich"
      lede={`Hallo ${user.displayName}. Was hier steht, sehen alle mit dem Häkchen Family — ausser deinem privaten Chat.`}
      // Die Bühne trägt den Einstieg, die Unterseiten bleiben ruhig. Ohne
      // diesen Index rendert `FamilyShell` einen schlichten Kopf — und dann
      // lief die App bis hierher ohne jede Szene, obwohl der family-Pool und
      // die vier family-Clips erzeugt und ausgeliefert werden.
      sceneIndex={dayIndex()}
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
        <Link className="family-kpi" href="/calendar">
          <strong>{upcoming.entries.length}</strong>
          <span>Termine in {UPCOMING_DAYS} Tagen</span>
        </Link>
      </div>

      <section className="family-section">
        <h2>Nächste Termine</h2>
        {upcoming.entries.length === 0 ? (
          <EmptyState
            icon="🗓"
            title="Nichts eingetragen"
            description={`In den nächsten ${UPCOMING_DAYS} Tagen steht im Haushalts-Kalender nichts an.`}
            action={
              <Link className="family-btn" href="/calendar">
                Zum Kalender
              </Link>
            }
          />
        ) : (
          <>
            <ul className="family-list">
              {upcoming.entries.slice(0, UPCOMING_SHOWN).map((entry) => (
                <li key={entry.id} className="family-row">
                  <div className="family-row-head">
                    {entry.members.map((member) => (
                      <MemberDot
                        key={member.id}
                        colour={member.colour}
                        title={member.displayName}
                      />
                    ))}
                    <strong>{entry.title}</strong>
                    <span className="family-muted">
                      {formatWhen(entry)}
                      {entry.location ? ` · ${entry.location}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="family-muted">
              {upcoming.entries.length > UPCOMING_SHOWN
                ? `${upcoming.entries.length - UPCOMING_SHOWN} weitere in den nächsten ${UPCOMING_DAYS} Tagen — `
                : ""}
              <Link href="/calendar">Zum Kalender</Link>
            </p>
          </>
        )}
      </section>

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
    </FamilyShell>
  );
}
