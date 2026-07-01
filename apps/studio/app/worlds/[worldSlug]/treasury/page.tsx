import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  getAppRepository,
  type CurrencyLedger,
} from "@uwe/database/server";
import {
  addPartyInventoryItemAction,
  deletePartyInventoryItemAction,
  updatePartyTreasuryAction,
} from "@/app/worlds/[worldSlug]/treasury-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ saved?: string; added?: string; deleted?: string }>;
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
  const { saved, added, deleted } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const treasuryService = createPartyTreasuryService(db);
  const treasury = await treasuryService.getOrCreateForWorld(world.id);
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
            Gemeinsame Währung und Gegenstände der Gruppe — im Portal für alle Spieler sichtbar.
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
            Notizen
            <textarea name="notes" rows={2} />
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
                  </p>
                  {(valueLabel || item.weight != null) && (
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>
                      {valueLabel ? `Wert: ${valueLabel}` : null}
                      {valueLabel && item.weight != null ? " · " : null}
                      {item.weight != null ? `Gewicht: ${item.weight}` : null}
                    </p>
                  )}
                  {item.notes && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }}>{item.notes}</p>
                  )}
                  <form action={deletePartyInventoryItemAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger">
                      Entfernen
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
