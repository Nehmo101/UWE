import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createCharacterService,
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  getAppRepository,
  getInventoryItemDmNotes,
  isInventoryItemDmOnly,
  type CurrencyLedger,
} from "@uwe/database/server";
import {
  addPartyInventoryItemAction,
  assignPartyItemToCharacterAction,
  deletePartyInventoryItemAction,
  returnPartyItemToTreasuryAction,
  updatePartyTreasuryAction,
} from "@/app/worlds/[worldSlug]/treasury-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ saved?: string; added?: string; deleted?: string; moved?: string }>;
}

const CURRENCY_LABELS: Record<keyof typeof DEFAULT_CURRENCIES, string> = {
  cp: "Kupfer (cp)",
  sp: "Silber (sp)",
  ep: "Elektron (ep)",
  gp: "Gold (gp)",
  pp: "Platin (pp)",
};

function parseCurrencyLedger(raw: unknown): CurrencyLedger {
  const currencies = { ...DEFAULT_CURRENCIES };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return currencies;
  }

  for (const key of Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      currencies[key] = Math.max(0, Math.floor(value));
    }
  }

  return currencies;
}

function formatItemValue(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parts = Object.entries(value as Record<string, unknown>)
    .filter(([, amount]) => typeof amount === "number" && Number.isFinite(amount))
    .map(([unit, amount]) => `${amount} ${unit.toUpperCase()}`);

  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function WorldTreasuryPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, added, deleted, moved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const treasuryService = createPartyTreasuryService(db);
  const treasury = await treasuryService.getOrCreateForWorld(world.id);
  const characterService = createCharacterService(db);
  const characters = await characterService.listForWorld(world.id);
  const characterItems = await treasuryService.listItemsHeldByCharacters(world.id);
  await db.$disconnect();

  const currencies = parseCurrencyLedger(treasury.currencies);
  const items = treasury.items;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Gruppenschatz",
            `/worlds/${worldSlug}/treasury`,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Gruppenschatz">
          <p className="uwe-hint" style={{ margin: 0 }}>
            Gemeinsame Währung und Gegenstände der Gruppe — im Portal für Spieler sichtbar.
            &bdquo;Nur DM&ldquo;-Items und DM-Notizen bleiben im Studio.
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Gruppenschatz"
        summary="Verwalte Gruppenwährung und gemeinsames Inventar dieser Welt."
      />

      {saved === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Gruppenschatz gespeichert.
        </p>
      )}
      {added === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Gegenstand hinzugefügt.
        </p>
      )}
      {deleted === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Gegenstand entfernt.
        </p>
      )}
      {moved === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Gegenstand verschoben.
        </p>
      )}

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Währung & Notizen</h2>
        <form action={updatePartyTreasuryAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />

          <label>
            Bezeichnung
            <input name="name" defaultValue={treasury.name} required />
          </label>

          <fieldset>
            <legend>Währung</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
                gap: "1rem",
              }}
            >
              {(Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[]).map((key) => (
                <label key={key}>
                  {CURRENCY_LABELS[key]}
                  <input
                    name={`currency_${key}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={currencies[key]}
                    required
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Notizen
            <textarea name="notes" rows={3} defaultValue={treasury.notes} />
          </label>

          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Speichern
          </button>
        </form>
      </section>

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Gegenstand hinzufügen</h2>
        <form action={addPartyInventoryItemAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />

          <label>
            Name
            <input name="name" required />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
            <label>
              Anzahl
              <input name="quantity" type="number" min={1} defaultValue={1} required />
            </label>
            <label>
              Gewicht (optional)
              <input name="weight" type="number" min={0} step={0.1} />
            </label>
            <label>
              Wert in GP (optional)
              <input name="valueGp" type="number" min={0} step={1} />
            </label>
          </div>

          <label>
            Notizen (für Spieler sichtbar)
            <textarea name="notes" rows={2} />
          </label>

          <label>
            DM-Notizen (nie im Portal sichtbar)
            <textarea name="dmNotes" rows={2} />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" name="dmOnly" />
            Nur für DM sichtbar (verstecktes Artefakt)
          </label>

          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Hinzufügen
          </button>
        </form>
      </section>

      <section className="uwe-v2-card">
        <h2 style={{ marginTop: 0 }}>Inventar ({items.length})</h2>
        {items.length === 0 ? (
          <p className="uwe-hint">Noch keine Gruppengegenstände erfasst.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((item) => {
              const valueLabel = formatItemValue(item.value);
              const dmNotes = getInventoryItemDmNotes(item);
              return (
                <li
                  key={item.id}
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: "0.65rem",
                  }}
                >
                  <p style={{ margin: "0 0 0.35rem" }}>
                    <strong>{item.name}</strong>
                    {item.quantity > 1 ? ` × ${item.quantity}` : null}
                    {isInventoryItemDmOnly(item) && (
                      <span className="uwe-badge" style={{ marginLeft: "0.5rem" }}>
                        Nur DM
                      </span>
                    )}
                  </p>
                  {(valueLabel || item.weight != null) && (
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>
                      {valueLabel ? `Wert: ${valueLabel}` : null}
                      {valueLabel && item.weight != null ? " · " : null}
                      {item.weight != null ? `Gewicht: ${item.weight}` : null}
                    </p>
                  )}
                  {item.notes && (
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>{item.notes}</p>
                  )}
                  {dmNotes && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }} className="uwe-hint">
                      DM-Notizen: {dmNotes}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    {characters.length > 0 && (
                      <form
                        action={assignPartyItemToCharacterAction}
                        style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
                      >
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <select name="characterId" defaultValue={characters[0]?.id}>
                          {characters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.displayName}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                          Charakter zuweisen
                        </button>
                      </form>
                    )}
                    <form action={deletePartyInventoryItemAction}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger"
                      >
                        Entfernen
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Bei Charakteren ({characterItems.length})</h2>
        {characterItems.length === 0 ? (
          <p className="uwe-hint">Aktuell trägt kein Charakter Gegenstände aus der Schatzkammer.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {characterItems.map((item) => {
              const dmNotes = getInventoryItemDmNotes(item);
              return (
                <li
                  key={item.id}
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: "0.65rem",
                  }}
                >
                  <p style={{ margin: "0 0 0.35rem" }}>
                    <strong>{item.name}</strong>
                    {item.quantity > 1 ? ` × ${item.quantity}` : null}
                    {" — "}
                    {item.character?.displayName ?? "Unbekannter Charakter"}
                    {isInventoryItemDmOnly(item) && (
                      <span className="uwe-badge" style={{ marginLeft: "0.5rem" }}>
                        Nur DM
                      </span>
                    )}
                  </p>
                  {item.notes && (
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>{item.notes}</p>
                  )}
                  {dmNotes && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }} className="uwe-hint">
                      DM-Notizen: {dmNotes}
                    </p>
                  )}
                  <form action={returnPartyItemToTreasuryAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                      Zurück in die Schatzkammer
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
