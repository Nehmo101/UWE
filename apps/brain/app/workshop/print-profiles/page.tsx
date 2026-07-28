import Link from "next/link";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createPrintProfileAction, deletePrintProfileAction } from "../../workshop-actions";

/** Druckprofile — was am Drucker eingestellt war, was rauskam, was nächstes Mal anders geht. */

export const dynamic = "force-dynamic";

export default async function BrainPrintProfilesPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Druckprofile">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const [profiles, projects] = await Promise.all([
    service.listWorkshopPrintProfiles({ limit: 200 }),
    service.listWorkshopProjects({ limit: 200 }),
  ]);

  return (
    <BrainShell
      active="/workshop"
      title="Druckprofile"
      lede={`${profiles.length} Profil(e) — Einstellungen, Ergebnis und was beim nächsten Mal anders sein soll.`}
      actions={
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop">
          ← Werkstatt
        </Link>
      }
    >
      <section className="brain-section">
        <h2>Neues Profil</h2>
        <form action={createPrintProfileAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Name
              <input name="name" required placeholder="z. B. Terrain grob, 0.6 Nozzle" />
            </label>
            <label>
              Drucker
              <input name="printer" />
            </label>
            <label>
              Nozzle
              <input name="nozzle" placeholder="0.4 mm" />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Filament
              <input name="filament" />
            </label>
            <label>
              Schichthöhe
              <input name="layerHeight" placeholder="0.2 mm" />
            </label>
            <label>
              Stützen
              <input name="supports" placeholder="ja / nein / Baum" />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Ergebnis
              <input name="result" />
            </label>
            <label>
              Fehler
              <input name="errors" />
            </label>
            <label>
              Nächstes Mal besser
              <input name="improvements" />
            </label>
          </div>
          <label>
            Projekt (optional)
            <select name="workshopProjectId" defaultValue="">
              <option value="">— keins —</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Profil speichern
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Profile · {profiles.length}</h2>
        {profiles.length === 0 ? (
          <p className="brain-muted">Noch keine Profile.</p>
        ) : (
          <ul className="brain-list">
            {profiles.map((profile) => (
              <li key={profile.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{profile.name || "(ohne Namen)"}</strong>
                  <span className="brain-muted">
                    {[profile.printer, profile.nozzle, profile.filament, profile.layerHeight]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <form action={deletePrintProfileAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={profile.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {profile.result ? <p>Ergebnis: {profile.result}</p> : null}
                {profile.errors ? <p className="brain-muted">Fehler: {profile.errors}</p> : null}
                {profile.improvements ? (
                  <p className="brain-muted">Nächstes Mal: {profile.improvements}</p>
                ) : null}
                {profile.notes ? <p className="brain-muted">{profile.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
