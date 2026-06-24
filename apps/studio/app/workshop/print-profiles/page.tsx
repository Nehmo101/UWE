import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { createPrintProfileAction, deletePrintProfileAction } from "../../workshop-actions";

export default async function WorkshopPrintProfilesPage() {
  const profiles = await createLifeAdminService(prisma).listWorkshopPrintProfiles({ limit: 200 });

  return (
    <AdminModuleShell
      activePath="/workshop"
      title="3D-Druck-Profile"
      summary="Historie erfolgreicher und gescheiterter Druckläufe — wiederverwendbar für ähnliche Teile."
    >
      <p className="uwe-dashboard-muted">
        <Link href="/workshop">← Werkstatt</Link>
      </p>

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neues Druckprofil</h2>
        <form action={createPrintProfileAction} className="uwe-brain-create-form">
          <label>
            Bezeichnung
            <input name="name" placeholder="z. B. Ruinen-Tile PLA" />
          </label>
          <label>
            Drucker
            <input name="printer" />
          </label>
          <label>
            Düse
            <input name="nozzle" placeholder="0.4 mm" />
          </label>
          <label>
            Filament
            <input name="filament" />
          </label>
          <label>
            Layerhöhe
            <input name="layerHeight" />
          </label>
          <label>
            Support
            <input name="supports" />
          </label>
          <label>
            Ergebnis
            <input name="result" />
          </label>
          <label>
            Fehler
            <textarea name="errors" rows={2} />
          </label>
          <label>
            Verbesserung
            <textarea name="improvements" rows={2} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Profil speichern
          </button>
        </form>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Historie ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <EmptyState
            title="Noch keine Druckprofile"
            description="Dokumentiere Drucker, Filament und Einstellungen nach jedem Lauf."
          />
        ) : (
          <div className="uwe-today-card-list">
            {profiles.map((profile) => (
              <article key={profile.id} className="uwe-today-card">
                <h3>{profile.name || "Drucklauf"}</h3>
                <p>
                  {profile.printer} · Düse {profile.nozzle} · {profile.filament} · Layer{" "}
                  {profile.layerHeight}
                </p>
                <p>
                  Support: {profile.supports || "—"} · Ergebnis: {profile.result || "—"}
                </p>
                {profile.errors && <p>Fehler: {profile.errors}</p>}
                {profile.improvements && <p>Verbesserung: {profile.improvements}</p>}
                {profile.workshopProject && (
                  <p>
                    <Link href={`/workshop/${profile.workshopProject.id}`}>
                      Projekt: {profile.workshopProject.title}
                    </Link>
                  </p>
                )}
                <form action={deletePrintProfileAction}>
                  <input type="hidden" name="id" value={profile.id} />
                  <input type="hidden" name="returnTo" value="/workshop/print-profiles" />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
