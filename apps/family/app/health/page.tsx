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
import { createHealthRecordAction, deleteHealthRecordAction } from "../health-actions";

/**
 * Gesundheit — Impfungen, Vorsorge, Medikamente, Tierarzt.
 *
 * Eine Akte je Mitglied, für Menschen und Tiere gleichermaßen: beide erzeugen
 * Termine im Haushalt. Was ein Datum hat, erscheint automatisch im Kalender —
 * niemand muss daraus von Hand einen Termin machen. Ins Abo aufs Handy gehen
 * nur die Fälligkeiten.
 */

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
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
                  <MemberDot
                    colour={resolveMemberColour(record.member)}
                    title={record.member.displayName}
                  />
                  <strong>{record.title}</strong>
                  <span className="family-tag">
                    {FAMILY_HEALTH_KIND_LABEL[record.kind as FamilyHealthRecordKind]}
                  </span>
                  <span className="family-muted">
                    {record.member.displayName} · fällig {formatDate(record.nextDueOn)}
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
            <div className="family-form-row">
              <label>
                Wer
                <select name="memberId" required>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
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
                  <MemberDot
                    colour={resolveMemberColour(record.member)}
                    title={record.member.displayName}
                  />
                  <strong>{record.title}</strong>
                  <span className="family-tag">
                    {FAMILY_HEALTH_KIND_LABEL[record.kind as FamilyHealthRecordKind]}
                  </span>
                  <span className="family-muted">
                    {record.member.displayName} · {formatDate(record.occurredOn)}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
