import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import {
  assignTreasuryItemToCharacterAction,
  returnTreasuryItemFromCharacterAction,
} from "@/app/treasury-actions";
import {
  createAuthService,
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  type CurrencyLedger,
  type PlayerSafeInventoryItemView,
  type PortalTreasuryView,
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

interface OwnCharacterInventory {
  id: string;
  displayName: string;
  items: PlayerSafeInventoryItemView[];
}

export default async function PortalTreasuryPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  let view: PortalTreasuryView | null = null;
  let ownCharacters: OwnCharacterInventory[] = [];
  const canMoveItems = Boolean(
    ctx.user && !ctx.previewAsUserId && ctx.effectiveRole === "player",
  );

  try {
    const treasuryService = createPartyTreasuryService(db);
    view = await treasuryService.getForViewer(worldSlug, ctx);
    if (!view) {
      notFound();
    }

    if (canMoveItems) {
      const auth = createAuthService(db);
      const characters = await auth.listCharactersForViewer(worldSlug, ctx);
      ownCharacters = await Promise.all(
        characters
          .filter((character) => character.ownerUserId === ctx.user?.id)
          .map(async (character) => ({
            id: character.id,
            displayName: character.displayName,
            items:
              (await treasuryService.listItemsForCharacterForViewer(
                worldSlug,
                character.id,
                ctx,
              )) ?? [],
          })),
      );
    }
  } finally {
    await db.$disconnect();
  }

  if (!view) {
    notFound();
  }

  const currencies = parseCurrencyLedger(view.currencies);
  const items = view.items;
  const notes = view.notes;

  const currencyEntries = (Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[])
    .map((key) => ({ key, label: CURRENCY_LABELS[key], amount: currencies[key] }))
    .filter((entry) => entry.amount > 0);

  const returnPath = `/auth/worlds/${worldSlug}/treasury`;

  return (
    <section className="portal-content-card">
      <h1>{view.name}</h1>
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
                  {canMoveItems && ownCharacters.length > 0 && (
                    <form
                      action={assignTreasuryItemToCharacterAction}
                      className="auth-note-form"
                      style={{ marginTop: "0.5rem" }}
                    >
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <label>
                        An Charakter übergeben
                        <select name="characterId" defaultValue={ownCharacters[0]?.id}>
                          {ownCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="auth-btn auth-btn-small">
                        Übernehmen
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canMoveItems && ownCharacters.length > 0 && (
        <section className="auth-block">
          <h2>Meine Charaktere</h2>
          {ownCharacters.map((character) => (
            <div key={character.id} style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.35rem" }}>{character.displayName}</h3>
              {character.items.length === 0 ? (
                <p className="auth-muted">Kein Inventar.</p>
              ) : (
                <ul className="auth-notes-list">
                  {character.items.map((item) => (
                    <li key={item.id} className="auth-note-item">
                      <header className="auth-note-header">
                        <strong>
                          {item.name}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </strong>
                      </header>
                      {item.notes && <p className="auth-note-content">{item.notes}</p>}
                      <form action={returnTreasuryItemFromCharacterAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <button type="submit" className="auth-btn auth-btn-small">
                          Zurück in die Schatzkammer
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
