import { createFamilyService } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { updateMemberProfileAction } from "../family-actions";

/**
 * Mitglieder (G13) — wer ist in der Family, und was weiß Family über sie.
 *
 * Zugänge werden hier *nicht* vergeben: das Häkchen `Family` setzt der Owner in
 * der Kommandozentrale, pro E-Mail-Adresse. Diese Seite zeigt nur die Profile,
 * und jede Person bearbeitet ausschließlich ihr eigenes.
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

  const service = createFamilyService(familyPrisma);
  await service.ensureMemberProfile({ userId: user.id, displayName: user.displayName });
  const members = await service.listMemberProfiles();
  const own = members.find((member) => member.userId === user.id);

  return (
    <FamilyShell
      active="/members"
      title="Mitglieder"
      eyebrow="Gemeinsamer Bereich"
      lede={`${members.length} Person(en). Wer dazukommt, entscheidet das Häkchen Family in der Kommandozentrale.`}
    >
      <section className="family-section">
        <h2>Dein Profil</h2>
        <form action={updateMemberProfileAction} className="family-form family-card">
          <div className="family-form-row">
            <label>
              Anzeigename
              <input name="displayName" defaultValue={own?.displayName ?? user.displayName} />
            </label>
            <label>
              Farbe
              <input name="colour" defaultValue={own?.colour ?? ""} placeholder="z. B. #7aa2f7" />
            </label>
          </div>
          <label>
            Notiz
            <textarea name="note" rows={2} defaultValue={own?.note ?? ""} />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Speichern
            </button>
          </div>
        </form>
      </section>

      <section className="family-section">
        <h2>Alle · {members.length}</h2>
        <ul className="family-list">
          {members.map((member) => (
            <li key={member.userId} className="family-row">
              <div className="family-row-head">
                <strong>{member.displayName}</strong>
                {member.userId === user.id ? <span className="family-tag">du</span> : null}
                {member.note ? <span className="family-muted">{member.note}</span> : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="family-muted">
          Ein Profil entsteht beim ersten Besuch. Wer das Häkchen verliert, kommt nicht mehr herein —
          das Profil bleibt, damit alte Beiträge weiter einen Namen haben.
        </p>
      </section>
    </FamilyShell>
  );
}
