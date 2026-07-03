import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import {
  createRollTableService,
  ROLL_TABLE_CATEGORIES,
  ROLL_TABLE_CATEGORY_LABELS,
  serializeRollTableEntries,
} from "@uwe/roll-tables";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  createRollTableAction,
  deleteRollTableAction,
  rollOnTableAction,
  seedRollTablePresetsAction,
  updateRollTableAction,
} from "@/app/worlds/[worldSlug]/roll-table-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
    seeded?: string;
    rolled?: string;
    rolledTable?: string;
  }>;
}

export default async function RollTablesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, deleted, seeded, rolled, rolledTable } = await searchParams;

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const tables = await createRollTableService(prisma).listForWorld(world.id);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Zufallstabellen",
            `/worlds/${worldSlug}/roll-tables`,
          )}
        />
      }
    >
      <PageHeader
        title="Zufallstabellen"
        summary="Loot, Zufalls-Encounter und Namen — gewichtete Tabellen mit Würfeln-Button für den Spieltisch."
      />

      {saved === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Tabelle gespeichert.
        </p>
      )}
      {deleted === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Tabelle gelöscht.
        </p>
      )}
      {seeded !== undefined && (
        <p className="uwe-banner uwe-banner-success" role="status">
          {seeded} Vorlagen-Tabelle(n) eingespielt.
        </p>
      )}

      {tables.length === 0 && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <p className="uwe-dashboard-muted">
            Noch keine Tabellen. Starte mit den Vorlagen (Loot, Encounter, Tavernen- und
            NPC-Namen) oder lege unten eine eigene an.
          </p>
          <form action={seedRollTablePresetsAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Vorlagen einspielen
            </button>
          </form>
        </section>
      )}

      {tables.map((table) => (
        <section key={table.id} className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">
            {table.name}{" "}
            <span className="uwe-dashboard-muted">
              ({ROLL_TABLE_CATEGORY_LABELS[table.category]}
              {table.dice ? ` · ${table.dice}` : ""} · {table.entries.length} Einträge)
            </span>
          </h2>
          {table.notes && <p className="uwe-dashboard-muted">{table.notes}</p>}

          {rolledTable === table.id && rolled && (
            <p className="uwe-banner uwe-banner-success" role="status">
              🎲 Ergebnis: <strong>{rolled}</strong>
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <form action={rollOnTableAction}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="tableId" value={table.id} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                🎲 Würfeln
              </button>
            </form>
            <form action={deleteRollTableAction}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="tableId" value={table.id} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                Löschen
              </button>
            </form>
          </div>

          <details style={{ marginTop: "0.75rem" }}>
            <summary>Bearbeiten</summary>
            <form action={updateRollTableAction} className="uwe-v2-form">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="tableId" value={table.id} />
              <label>
                Name
                <input name="name" defaultValue={table.name} required />
              </label>
              <label>
                Kategorie
                <select name="category" defaultValue={table.category}>
                  {ROLL_TABLE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {ROLL_TABLE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Würfel (optional, z. B. d20)
                <input name="dice" defaultValue={table.dice ?? ""} />
              </label>
              <label>
                Einträge (einer pro Zeile, optional „| Gewicht“)
                <textarea
                  name="entries"
                  rows={Math.min(14, table.entries.length + 2)}
                  defaultValue={serializeRollTableEntries(table.entries)}
                  required
                />
              </label>
              <label>
                Notizen
                <input name="notes" defaultValue={table.notes ?? ""} />
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                Speichern
              </button>
            </form>
          </details>
        </section>
      ))}

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neue Tabelle</h2>
        <form action={createRollTableAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <label>
            Name
            <input name="name" required placeholder="z. B. Loot — Räuberlager" />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue="custom">
              {ROLL_TABLE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {ROLL_TABLE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Würfel (optional)
            <input name="dice" placeholder="d20" />
          </label>
          <label>
            Einträge (einer pro Zeile, optional „| Gewicht“)
            <textarea
              name="entries"
              rows={8}
              required
              placeholder={"Goldbeutel | 3\nRostiger Schlüssel\nHeiltrank | 2"}
            />
          </label>
          <label>
            Notizen (optional)
            <input name="notes" />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Tabelle anlegen
          </button>
        </form>
        {tables.length > 0 && (
          <form action={seedRollTablePresetsAction} style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
              Fehlende Vorlagen einspielen
            </button>
          </form>
        )}
      </section>
    </WorldShell>
  );
}
