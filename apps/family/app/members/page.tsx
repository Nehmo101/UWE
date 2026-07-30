import { familyPrisma } from "@uwe/database/family-client";
import {
  FAMILY_MEMBER_KIND_LABEL,
  createFamilyMemberService,
  resolveMemberColour,
  type FamilyMemberKind,
} from "@uwe/family-core";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { MemberDot, MemberFields } from "@/src/components/members/MemberFields";
import {
  createMemberAction,
  removeMemberAction,
  updateMemberAction,
  updateOwnProfileAction,
} from "../member-actions";

/**
 * Mitglieder (G13) — wer gehört zum Haushalt.
 *
 * Ein Mitglied braucht kein Konto: Kleinkind, Gast und Haustier werden hier
 * angelegt und melden sich nie an. Wer sich anmelden kann, bekommt sein
 * Mitglied beim ersten Besuch automatisch.
 *
 * Zugänge werden hier *nicht* vergeben: das Häkchen `Family` setzt der Owner in
 * der Kommandozentrale, pro E-Mail-Adresse. Das eigene Profil pflegt jede
 * Person selbst; Mitglieder ohne Konto pflegt der Haushalt gemeinsam.
 */

export const dynamic = "force-dynamic";

export default async function FamilyMembersPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/members" title="Mitglieder">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const service = createFamilyMemberService(familyPrisma);
  const own = await service.ensureMemberForUser({
    userId: user.id,
    displayName: user.displayName,
  });
  const members = await service.listMembers({ includeInactive: true });
  const withoutAccount = members.filter((member) => member.userId === null);

  return (
    <FamilyShell
      active="/members"
      title="Mitglieder"
      eyebrow="Gemeinsamer Bereich"
      lede={`${members.length} Person(en) im Haushalt. Wer sich anmelden darf, entscheidet das Häkchen Family in der Kommandozentrale — wer im Haushalt lebt, entscheidet ihr hier.`}
    >
      <section className="family-section">
        <h2>Dein Profil</h2>
        <form action={updateOwnProfileAction} className="family-form family-card">
          <MemberFields
            showKind={false}
            values={{
              displayName: own.displayName,
              colour: resolveMemberColour(own),
              note: own.note,
              birthdayOn: own.birthdayOn,
              anniversaryOn: own.anniversaryOn,
              anniversaryLabel: own.anniversaryLabel,
            }}
          />
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Speichern
            </button>
          </div>
        </form>
        <p className="family-muted">
          Deine Farbe kennzeichnet dich im Kalender. Geburtstag und Jahrestag erscheinen jedes Jahr
          automatisch — auch im Kalender-Abo auf dem Handy.
        </p>
      </section>

      <section className="family-section">
        <h2>Alle · {members.length}</h2>
        <ul className="family-list">
          {members.map((member) => (
            <li key={member.id} className="family-row">
              <div className="family-row-head">
                <MemberDot colour={resolveMemberColour(member)} />
                <strong>{member.displayName}</strong>
                <span className="family-tag">
                  {FAMILY_MEMBER_KIND_LABEL[member.kind as FamilyMemberKind]}
                </span>
                {member.id === own.id ? <span className="family-tag">du</span> : null}
                {member.userId === null ? (
                  <span className="family-muted">ohne Konto</span>
                ) : null}
                {!member.isActive ? <span className="family-tag family-tag-warn">inaktiv</span> : null}
                {member.note ? <span className="family-muted">{member.note}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="family-section">
        <h2>Mitglied ohne Konto hinzufügen</h2>
        <form action={createMemberAction} className="family-form family-card">
          <MemberFields values={{}} />
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Hinzufügen
            </button>
          </div>
        </form>
        <p className="family-muted">
          Für alle, die im Haushalt vorkommen, aber sich nie anmelden: ein Kleinkind, ein Gast, die
          Katze. Sie bekommen Farbe, Termine und eine eigene Gesundheitsakte — nur kein Login.
        </p>
      </section>

      {withoutAccount.length > 0 ? (
        <section className="family-section">
          <h2>Mitglieder ohne Konto bearbeiten</h2>
          {withoutAccount.map((member) => (
            <form key={member.id} action={updateMemberAction} className="family-form family-card">
              <input type="hidden" name="id" value={member.id} />
              <MemberFields
                values={{
                  displayName: member.displayName,
                  colour: resolveMemberColour(member),
                  note: member.note,
                  kind: member.kind,
                  birthdayOn: member.birthdayOn,
                  anniversaryOn: member.anniversaryOn,
                  anniversaryLabel: member.anniversaryLabel,
                }}
              />
              <div className="family-head-actions">
                <button type="submit" className="family-btn family-btn-sm">
                  Speichern
                </button>
                <button
                  type="submit"
                  formAction={removeMemberAction}
                  className="family-btn family-btn-sm family-btn-ghost"
                >
                  Entfernen
                </button>
              </div>
            </form>
          ))}
        </section>
      ) : null}
    </FamilyShell>
  );
}
