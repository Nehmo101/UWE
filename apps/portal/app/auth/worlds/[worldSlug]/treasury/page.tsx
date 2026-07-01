import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import {
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  type CurrencyLedger,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const CURRENCY_LABELS: Record<keyof typeof DEFAULT_CURRENCIES, string> = {
  cp: "Kupfer",
  sp: "Silber",
  ep: "Elektron",
  gp: "Gold",
  pp: "Platin",
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

export default async function PortalTreasuryPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  let treasuryName = "Gruppenschatz";
  let currencies = { ...DEFAULT_CURRENCIES };
  let notes = "";
  let items: {
    id: string;
    name: string;
    quantity: number;
    weight: number | null;
    value: unknown;
    notes: string;
  }[] = [];

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      notFound();
    }

    const treasuryService = createPartyTreasuryService(db);
    const treasury = await treasuryService.getByWorldId(world.id);
    if (treasury) {
      treasuryName = treasury.name;
      currencies = parseCurrencyLedger(treasury.currencies);
      notes = treasury.notes;
      items = treasury.items;
    }
  } finally {
    await db.$disconnect();
  }

  const currencyEntries = (Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[])
    .map((key) => ({ key, label: CURRENCY_LABELS[key], amount: currencies[key] }))
    .filter((entry) => entry.amount > 0);

  return (
    <section className="portal-content-card">
      <h1>{treasuryName}</h1>
      <p className="auth-lead">Gemeinsame Währung und Gegenstände eurer Gruppe.</p>

      <section className="auth-block">
        <h2>Währung</h2>
        {currencyEntries.length === 0 ? (
          <p className="auth-muted">Keine Währung erfasst.</p>
        ) : (
          <ul className="auth-page-list">
            {currencyEntries.map((entry) => (
              <li key={entry.key}>
                <strong>{entry.label}</strong>
                <span>{entry.amount.toLocaleString("de-DE")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notes && (
        <section className="auth-block">
          <h2>Notizen</h2>
          <p className="auth-note-content">{notes}</p>
        </section>
      )}

      <section className="auth-block">
        <h2>Inventar ({items.length})</h2>
        {items.length === 0 ? (
          <p className="auth-muted">Noch keine Gruppengegenstände.</p>
        ) : (
          <ul className="auth-notes-list">
            {items.map((item) => {
              const valueLabel = formatItemValue(item.value);
              return (
                <li key={item.id} className="auth-note-item">
                  <header className="auth-note-header">
                    <strong>
                      {item.name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </strong>
                  </header>
                  {(valueLabel || item.weight != null) && (
                    <p className="auth-muted" style={{ margin: "0.35rem 0" }}>
                      {valueLabel ? `Wert: ${valueLabel}` : null}
                      {valueLabel && item.weight != null ? " · " : null}
                      {item.weight != null ? `Gewicht: ${item.weight}` : null}
                    </p>
                  )}
                  {item.notes && <p className="auth-note-content">{item.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
