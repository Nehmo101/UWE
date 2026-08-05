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
  toggleMemberActiveAction,
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
 * Bearbeiten darf hier jeder jeden — Family kennt keine Rollen und keine
 * Sichtbarkeitsstufen. Farbe, Geburtstag und Jahrestag stehen im Kalender
 * aller; sie hinter einem fremden Konto zu verstecken hätte niemandem genützt.
 * Das eigene Profil steht zusätzlich oben, als kurzer Weg.
 *
 * Zugänge werden hier *nicht* vergeben: das Häkchen `Family` setzt der Owner in
 * der Kommandozentrale, pro E-Mail-Adresse.
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
        <h2>Alle bearbeiten · {members.length}</h2>
        <p className="family-muted">
          Jedes Mitglied lässt sich hier pflegen — auch die mit eigenem Konto. Der Name aus der
          Anmeldung ist nur der Startwert; was hier steht, bleibt stehen.
        </p>
        {members.map((member) => (
          <form key={member.id} action={updateMemberAction} className="family-form family-card">
            <input type="hidden" name="id" value={member.id} />
            <div className="family-row-head">
              <MemberDot colour={resolveMemberColour(member)} />
              <strong>{member.displayName}</strong>
              <span className="family-tag">
                {FAMILY_MEMBER_KIND_LABEL[member.kind as FamilyMemberKind]}
              </span>
              {member.id === own.id ? <span className="family-tag">du</span> : null}
              {member.userId === null ? <span className="family-muted">ohne Konto</span> : null}
              {!member.isActive ? <span className="family-tag family-tag-warn">inaktiv</span> : null}
            </div>
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
                formAction={toggleMemberActiveAction}
                className="family-btn family-btn-sm family-btn-ghost"
              >
                {member.isActive ? "Deaktivieren" : "Wieder aktivieren"}
              </button>
              {member.userId === null ? (
                <button
                  type="submit"
                  formAction={removeMemberAction}
                  className="family-btn family-btn-sm family-btn-ghost"
                >
                  Entfernen
                </button>
              ) : null}
            </div>
          </form>
        ))}
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
    </FamilyShell>
  );
}
