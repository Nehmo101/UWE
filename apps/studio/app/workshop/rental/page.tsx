import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  formatChecklistForForm,
  formatEuroFromCents,
  prisma,
  WORKSHOP_RENTAL_STATUS_LABELS,
  WorkshopRentalStatusEnum,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createTerrainRentalAction,
  deleteTerrainRentalAction,
  updateTerrainRentalAction,
} from "../../workshop-actions";

export default async function WorkshopRentalPage() {
  const rentals = await createLifeAdminService(prisma).listWorkshopTerrainRentals({ limit: 200 });

  return (
    <AdminModuleShell
      activePath="/workshop"
      title="Terrain-Verleih"
      summary="Sets, Kisten, Kaution und Übergabe-Checklisten — optional für Ausleihe an Spieler."
    >
      <p className="uwe-dashboard-muted">
        <Link href="/workshop">← Werkstatt</Link>
      </p>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neues Terrain-Set</h2>
        <form action={createTerrainRentalAction} className="uwe-brain-create-form">
          <label>
            Terrain-Set
            <input name="terrainSetName" required placeholder="z. B. Wald-Ruinen Komplett" />
          </label>
          <label>
            Kiste/Box
            <input name="boxLabel" placeholder="Box A3" />
          </label>
          <label>
            Ersatzwert (Cent)
            <input name="replacementValueCents" type="number" min={0} />
          </label>
          <label>
            Mietpreis (Cent)
            <input name="rentalPriceCents" type="number" min={0} />
          </label>
          <label>
            Kaution (Cent)
            <input name="depositCents" type="number" min={0} />
          </label>
          <label>
            Status
            <select name="status" defaultValue="available">
              {Object.values(WorkshopRentalStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {WORKSHOP_RENTAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Schäden
            <textarea name="damages" rows={2} />
          </label>
          <label>
            Übergabe-Checkliste ([x] erledigt)
            <textarea
              name="handoverChecklist"
              rows={3}
              placeholder={"[ ] Alle Teile gezählt\n[ ] Transportkiste intakt"}
            />
          </label>
          <label>
            Rückgabe-Checkliste
            <textarea name="returnChecklist" rows={3} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Set anlegen
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Bestand ({rentals.length})</h2>
        {rentals.length === 0 ? (
          <EmptyState
            title="Noch keine Verleih-Sets"
            description="Lege Terrain-Sets mit Kisten und Checklisten an, wenn du verleihen möchtest."
          />
        ) : (
          <div className="uwe-today-card-list">
            {rentals.map((rental) => (
              <article key={rental.id} className="uwe-today-card">
                <form action={updateTerrainRentalAction} className="uwe-brain-create-form">
                  <input type="hidden" name="id" value={rental.id} />
                  <label>
                    Terrain-Set
                    <input name="terrainSetName" defaultValue={rental.terrainSetName} required />
                  </label>
                  <label>
                    Kiste
                    <input name="boxLabel" defaultValue={rental.boxLabel} />
                  </label>
                  <label>
                    Ersatzwert (Cent)
                    <input
                      name="replacementValueCents"
                      type="number"
                      min={0}
                      defaultValue={rental.replacementValueCents ?? ""}
                    />
                  </label>
                  <label>
                    Mietpreis (Cent)
                    <input
                      name="rentalPriceCents"
                      type="number"
                      min={0}
                      defaultValue={rental.rentalPriceCents ?? ""}
                    />
                  </label>
                  <label>
                    Kaution (Cent)
                    <input
                      name="depositCents"
                      type="number"
                      min={0}
                      defaultValue={rental.depositCents ?? ""}
                    />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={rental.status}>
                      {Object.values(WorkshopRentalStatusEnum).map((status) => (
                        <option key={status} value={status}>
                          {WORKSHOP_RENTAL_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Schäden
                    <textarea name="damages" rows={2} defaultValue={rental.damages} />
                  </label>
                  <label>
                    Übergabe
                    <textarea
                      name="handoverChecklist"
                      rows={3}
                      defaultValue={formatChecklistForForm(rental.handoverChecklist)}
                    />
                  </label>
                  <label>
                    Rückgabe
                    <textarea
                      name="returnChecklist"
                      rows={3}
                      defaultValue={formatChecklistForForm(rental.returnChecklist)}
                    />
                  </label>
                  <label>
                    Notizen
                    <textarea name="notes" rows={2} defaultValue={rental.notes} />
                  </label>
                  <p className="uwe-dashboard-muted">
                    {WORKSHOP_RENTAL_STATUS_LABELS[rental.status]}
                    {rental.rentalPriceCents != null
                      ? ` · Miete ${formatEuroFromCents(rental.rentalPriceCents)}`
                      : ""}
                    {rental.depositCents != null
                      ? ` · Kaution ${formatEuroFromCents(rental.depositCents)}`
                      : ""}
                  </p>
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deleteTerrainRentalAction}>
                  <input type="hidden" name="id" value={rental.id} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
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
