import { createMiniatureCollectionService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createMiniatureAction,
  deleteMiniatureAction,
  updateMiniatureAction,
} from "../brain-actions";

export const dynamic = "force-dynamic";

const STATUS: Array<{ value: string; label: string }> = [
  { value: "purchased", label: "Gekauft" },
  { value: "built", label: "Gebaut" },
  { value: "primed", label: "Grundiert" },
  { value: "painted", label: "Bemalt" },
];

export default async function BrainMiniaturesPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/miniatures" title="Miniaturen">
        <BrainDenied />
      </BrainShell>
    );
  }

  const items = await createMiniatureCollectionService(brainPrisma).listItems();

  return (
    <BrainShell
      active="/miniatures"
      title="Miniaturen-Sammlung"
      lede={`${items.length} Eintrag/Einträge — persönliche Hobby-Sammlung. Kaufstatus, Fraktionen, Bemal-Fortschritt.`}
    >
      <section className="brain-section">
        <h2>Neue Miniatur / Einheit</h2>
        <form action={createMiniatureAction} className="brain-form brain-card">
          <label>
            Name
            <input name="name" required placeholder="z. B. Space Marine Squad" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Hersteller
              <input name="manufacturer" placeholder="z. B. Games Workshop" />
            </label>
            <label>
              Spielsystem
              <input name="gameSystem" placeholder="z. B. Warhammer 40k" />
            </label>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr" }}>
            <label>
              Fraktion
              <input name="faction" placeholder="z. B. Ultramarines" />
            </label>
            <label>
              Anzahl
              <input name="quantity" type="number" min={1} defaultValue={1} />
            </label>
            <label>
              Status
              <select name="status" defaultValue="purchased">
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button type="submit" className="brain-btn">
              Hinzufügen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Sammlung · {items.length}</h2>
        {items.length === 0 ? (
          <p className="brain-muted">Keine Miniaturen erfasst.</p>
        ) : (
          <ul className="brain-list">
            {items.map((item) => (
              <li key={item.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{item.name}</strong>
                  <span className="brain-tag">{item.status}</span>
                  <span className="brain-muted">
                    {item.quantity}×{item.gameSystem ? ` · ${item.gameSystem}` : ""}
                    {item.faction ? ` · ${item.faction}` : ""}
                  </span>
                  <form action={deleteMiniatureAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateMiniatureAction} className="brain-form">
                    <input type="hidden" name="id" value={item.id} />
                    <label>
                      Name
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
                      <label>
                        Hersteller
                        <input name="manufacturer" defaultValue={item.manufacturer ?? ""} />
                      </label>
                      <label>
                        Spielsystem
                        <input name="gameSystem" defaultValue={item.gameSystem ?? ""} />
                      </label>
                    </div>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr" }}>
                      <label>
                        Fraktion
                        <input name="faction" defaultValue={item.faction ?? ""} />
                      </label>
                      <label>
                        Anzahl
                        <input name="quantity" type="number" min={1} defaultValue={item.quantity} />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={item.status}>
                          {STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div>
                      <button type="submit" className="brain-btn brain-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
