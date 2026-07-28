import Link from "next/link";
import {
  createLifeAdminService,
  formatEuroFromCents,
  parseStringArray,
  prisma,
  WORKSHOP_RENTAL_STATUS_LABELS,
  WorkshopRentalStatusEnum,
  type WorkshopRentalStatus,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createTerrainRentalAction,
  deleteTerrainRentalAction,
  updateTerrainRentalAction,
} from "../../workshop-actions";

/** Terrain-Verleih — welches Set ist wo, was kostet es, was fehlt bei der Rückgabe. */

export const dynamic = "force-dynamic";

const STATUSES = Object.values(WorkshopRentalStatusEnum) as WorkshopRentalStatus[];

function euro(cents: number | null | undefined): string {
  return cents ? formatEuroFromCents(cents) : "—";
}

function StatusSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label>
      Status
      <select name="status" defaultValue={defaultValue}>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {WORKSHOP_RENTAL_STATUS_LABELS[status] ?? status}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function BrainTerrainRentalPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Terrain-Verleih">
        <BrainDenied />
      </BrainShell>
    );
  }

  const rentals = await createLifeAdminService(brainPrisma, prisma).listWorkshopTerrainRentals({
    limit: 200,
  });
  const out = rentals.filter((rental) => rental.status === "on_loan").length;

  return (
    <BrainShell
      active="/workshop"
      title="Terrain-Verleih"
      lede={`${rentals.length} Set(s)${out ? ` · ${out} unterwegs` : ""} — Kaution, Preis und Rückgabe-Checkliste an einem Ort.`}
      actions={
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop">
          ← Werkstatt
        </Link>
      }
    >
      <section className="brain-section">
        <h2>Neues Set</h2>
        <form action={createTerrainRentalAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Set-Name
              <input name="terrainSetName" required placeholder="z. B. Dorf-Set klein" />
            </label>
            <label>
              Kiste / Beschriftung
              <input name="boxLabel" />
            </label>
            <StatusSelect defaultValue="available" />
          </div>
          <div className="brain-form-row">
            <label>
              Wiederbeschaffungswert (€)
              <input name="replacementValue" inputMode="decimal" placeholder="0,00" />
            </label>
            <label>
              Leihpreis (€)
              <input name="rentalPrice" inputMode="decimal" placeholder="0,00" />
            </label>
            <label>
              Kaution (€)
              <input name="deposit" inputMode="decimal" placeholder="0,00" />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Übergabe-Checkliste (eine Zeile pro Punkt)
              <textarea name="handoverChecklist" rows={3} />
            </label>
            <label>
              Rückgabe-Checkliste
              <textarea name="returnChecklist" rows={3} />
            </label>
          </div>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Set anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Sets · {rentals.length}</h2>
        {rentals.length === 0 ? (
          <p className="brain-muted">Noch keine Sets erfasst.</p>
        ) : (
          <ul className="brain-list">
            {rentals.map((rental) => {
              const handover = parseStringArray(rental.handoverChecklist);
              const back = parseStringArray(rental.returnChecklist);
              return (
                <li key={rental.id} className="brain-row">
                  <div className="brain-row-head">
                    <strong>{rental.terrainSetName}</strong>
                    <span
                      className={
                        rental.status === "maintenance" || rental.status === "retired"
                          ? "brain-tag brain-tag-warn"
                          : "brain-tag"
                      }
                    >
                      {WORKSHOP_RENTAL_STATUS_LABELS[rental.status] ?? rental.status}
                    </span>
                    <span className="brain-muted">
                      {rental.boxLabel ? `${rental.boxLabel} · ` : ""}
                      Leihe {euro(rental.rentalPriceCents)} · Kaution {euro(rental.depositCents)} ·
                      Wert {euro(rental.replacementValueCents)}
                    </span>
                    <form action={deleteTerrainRentalAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={rental.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>

                  {rental.damages ? (
                    <p className="brain-callout brain-callout-warn">Schäden: {rental.damages}</p>
                  ) : null}
                  {handover.length > 0 ? (
                    <p className="brain-muted">Übergabe: {handover.join(" · ")}</p>
                  ) : null}
                  {back.length > 0 ? (
                    <p className="brain-muted">Rückgabe: {back.join(" · ")}</p>
                  ) : null}
                  {rental.notes ? <p>{rental.notes}</p> : null}

                  <details className="brain-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updateTerrainRentalAction} className="brain-form">
                      <input type="hidden" name="id" value={rental.id} />
                      <div className="brain-form-row">
                        <label>
                          Set-Name
                          <input name="terrainSetName" defaultValue={rental.terrainSetName} required />
                        </label>
                        <label>
                          Kiste / Beschriftung
                          <input name="boxLabel" defaultValue={rental.boxLabel} />
                        </label>
                        <StatusSelect defaultValue={rental.status} />
                      </div>
                      <div className="brain-form-row">
                        <label>
                          Wiederbeschaffungswert (€)
                          <input
                            name="replacementValue"
                            inputMode="decimal"
                            defaultValue={
                              rental.replacementValueCents
                                ? (rental.replacementValueCents / 100).toFixed(2)
                                : ""
                            }
                          />
                        </label>
                        <label>
                          Leihpreis (€)
                          <input
                            name="rentalPrice"
                            inputMode="decimal"
                            defaultValue={
                              rental.rentalPriceCents ? (rental.rentalPriceCents / 100).toFixed(2) : ""
                            }
                          />
                        </label>
                        <label>
                          Kaution (€)
                          <input
                            name="deposit"
                            inputMode="decimal"
                            defaultValue={rental.depositCents ? (rental.depositCents / 100).toFixed(2) : ""}
                          />
                        </label>
                      </div>
                      <div className="brain-form-row">
                        <label>
                          Übergabe-Checkliste
                          <textarea name="handoverChecklist" rows={3} defaultValue={handover.join("\n")} />
                        </label>
                        <label>
                          Rückgabe-Checkliste
                          <textarea name="returnChecklist" rows={3} defaultValue={back.join("\n")} />
                        </label>
                      </div>
                      <label>
                        Schäden
                        <textarea name="damages" rows={2} defaultValue={rental.damages} />
                      </label>
                      <label>
                        Notizen
                        <textarea name="notes" rows={2} defaultValue={rental.notes} />
                      </label>
                      <div>
                        <button type="submit" className="brain-btn brain-btn-sm">
                          Speichern
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
