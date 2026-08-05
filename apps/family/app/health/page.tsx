import { familyPrisma } from "@uwe/database/family-client";
import {
  FAMILY_HEALTH_KIND_LABEL,
  FAMILY_HEALTH_RECORD_KINDS,
  createFamilyHealthService,
  createFamilyMemberService,
  resolveMemberColour,
  type FamilyHealthRecordKind,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { MemberDot } from "@/src/components/members/MemberFields";
import { MemberChecklist } from "@/src/components/members/MemberChecklist";
import {
  createHealthRecordAction,
  deleteHealthRecordAction,
  setHealthRecordMembersAction,
} from "../health-actions";

/**
 * Gesundheit — Impfungen, Vorsorge, Medikamente, Tierarzt.
 *
 * Eine Akte für den ganzen Haushalt, für Menschen und Tiere gleichermaßen:
 * beide erzeugen Termine. Ein Eintrag betrifft eine oder mehrere Personen — die
 * Wurmkur beide Katzen, die Grippeimpfung die ganze Familie. Was ein Datum hat,
 * erscheint automatisch im Kalender — niemand muss daraus von Hand einen Termin
 * machen. Ins Abo aufs Handy gehen nur die Fälligkeiten.
 */

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface RecordMember {
  id: string;
  displayName: string;
  colour: string;
}

/** Die Punkte der beteiligten Personen — bei einer wie bei fünf. */
function MemberDots({ members }: { members: readonly RecordMember[] }) {
  return (
    <>
      {members.map((member) => (
        <MemberDot key={member.id} colour={member.colour} title={member.displayName} />
      ))}
    </>
  );
}

function memberNames(members: readonly RecordMember[]): string {
  return members.length > 0 ? members.map((member) => member.displayName).join(", ") : "ohne Person";
}

export default async function FamilyHealthPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/health" title="Gesundheit">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const health = createFamilyHealthService(familyPrisma);
  const [members, records] = await Promise.all([
    createFamilyMemberService(familyPrisma).listMembers(),
    health.listAll(),
  ]);

  const now = new Date();
  const inSixMonths = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const due = await health.listDueUntil(inSixMonths, now);

  const memberOptions = members.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    colour: resolveMemberColour(member),
  }));

  return (
    <FamilyShell
      active="/health"
      title="Gesundheit"
      eyebrow="Gemeinsamer Bereich"
      lede={`${records.length} Eintrag/Einträge. Was ein Datum hat, steht automatisch im Kalender — auch für die Katze.`}
    >
      {due.length > 0 ? (
        <section className="family-section">
          <h2>Demnächst fällig · {due.length}</h2>
          <ul className="family-list">
            {due.map((record) => (
              <li key={record.id} className="family-row">
                <div className="family-row-head">
                  <MemberDots members={record.members} />
                  <strong>{record.title}</strong>
                  <span className="family-tag">
                    {FAMILY_HEALTH_KIND_LABEL[record.kind as FamilyHealthRecordKind]}
                  </span>
                  <span className="family-muted">
                    {memberNames(record.members)} · fällig {formatDate(record.nextDueOn)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="family-section">
        <h2>Neuer Eintrag</h2>
        {members.length === 0 ? (
          <p className="family-muted">Lege zuerst ein Mitglied an.</p>
        ) : (
          <form action={createHealthRecordAction} className="family-form family-card">
            <MemberChecklist
              members={memberOptions}
              name="memberIds"
              legend="Wen betrifft der Eintrag? (mindestens eine Person)"
            />
            <div className="family-form-row">
              <label>
                Art
                <select name="kind" defaultValue="other">
                  {FAMILY_HEALTH_RECORD_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {FAMILY_HEALTH_KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bezeichnung
                <input name="title" required placeholder="z. B. Tollwut-Impfung" />
              </label>
            </div>
            <div className="family-form-row">
              <label>
                Wann war es
                <input type="date" name="occurredOn" />
              </label>
              <label>
                Nächste Fälligkeit
                <input type="date" name="nextDueOn" />
              </label>
            </div>
            <label>
              Notiz
              <textarea name="notes" rows={2} />
            </label>
            <div>
              <button type="submit" className="family-btn family-btn-sm">
                Eintragen
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="family-section">
        <h2>Akte · {records.length}</h2>
        {records.length === 0 ? (
          <p className="family-muted">Noch nichts eingetragen.</p>
        ) : (
          <ul className="family-list">
            {records.map((record) => (
              <li key={record.id} className="family-row">
                <div className="family-row-head">
                  <MemberDots members={record.members} />
                  <strong>{record.title}</strong>
                  <span className="family-tag">
                    {FAMILY_HEALTH_KIND_LABEL[record.kind as FamilyHealthRecordKind]}
                  </span>
                  <span className="family-muted">
                    {memberNames(record.members)} · {formatDate(record.occurredOn)}
                    {record.nextDueOn ? ` · nächste ${formatDate(record.nextDueOn)}` : ""}
                  </span>
                  <form action={deleteHealthRecordAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={record.id} />
                    <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {record.notes ? <p className="family-muted">{record.notes}</p> : null}
                <details className="family-edit">
                  <summary>Wen betrifft das?</summary>
                  <form action={setHealthRecordMembersAction} className="family-form">
                    <input type="hidden" name="id" value={record.id} />
                    <MemberChecklist
                      members={memberOptions}
                      name="memberIds"
                      legend="Beteiligte Personen — mindestens eine"
                      selected={record.members.map((member) => member.id)}
                    />
                    <div>
                      <button type="submit" className="family-btn family-btn-sm">
                        Zuordnung speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
