import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createBringService,
  createShoppingService,
  formatAmount,
  SHOPPING_CATEGORY_LABELS,
  type IngredientUnit,
  type ShoppingCategory,
} from "@uwe/kitchen";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { FamilyShoppingOffline } from "@/src/components/FamilyShoppingOffline";
import {
  addShoppingItemAction,
  createManualListAction,
  removeShoppingItemAction,
  toggleShoppingItemAction,
} from "@/app/kitchen-actions";
import {
  connectBringAction,
  disconnectBringAction,
  pushListToBringAction,
  refreshBringListsAction,
  setBringListAction,
  syncListWithBringAction,
} from "@/app/kitchen-bring-actions";

/**
 * Einkaufslisten — aus dem Wochenplan erzeugt oder von Hand, nach Kategorie
 * sortiert und zum Abhaken.
 *
 * Die Bring!-Anbindung steht unten statt oben: sie ist optional, und wer im
 * Laden steht, will zuerst die Liste sehen.
 */

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ list?: string; bring?: string; msg?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const DATETIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function FamilyShoppingPage({ searchParams }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Einkauf">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { list: listId, bring: bringFlag, msg } = await searchParams;

  const shopping = createShoppingService(familyPrisma);
  const [lists, active, bringStatus, suggestions] = await Promise.all([
    shopping.listLists(),
    listId ? shopping.getList(listId) : Promise.resolve(null),
    createBringService(familyPrisma).getStatus(),
    shopping.getItemSuggestions(),
  ]);

  const grouped = new Map<ShoppingCategory, NonNullable<typeof active>["items"]>();
  for (const item of active?.items ?? []) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  const canPush = bringStatus.connected && Boolean(bringStatus.defaultListUuid);

  return (
    <FamilyShell
      active="/kitchen"
      title="Einkauf"
      eyebrow="Küche"
      lede={active ? active.title : `${lists.length} Liste(n)`}
      actions={
        <Link href="/kitchen" className="family-btn family-btn-ghost family-btn-sm">
          ← Küche
        </Link>
      }
    >
      {bringFlag ? (
        <p
          className={
            bringFlag === "ok"
              ? "family-callout"
              : "family-callout family-callout-warn"
          }
        >
          {msg ?? (bringFlag === "ok" ? "Bring!: erledigt." : "Bring!: Fehler.")}
        </p>
      ) : null}

      <section className="family-section">
        <h2>Listen · {lists.length}</h2>
        <form action={createManualListAction} className="family-form family-form-inline family-card">
          <label>
            Neue Liste
            <input type="text" name="title" placeholder="z. B. Wocheneinkauf" />
          </label>
          <button type="submit" className="family-btn family-btn-sm">
            + Anlegen
          </button>
        </form>
        {lists.length === 0 ? (
          <p className="family-muted">
            Noch keine Liste. Leg oben eine an oder erzeuge eine im{" "}
            <Link href="/kitchen/plan">Wochenplan</Link>.
          </p>
        ) : (
          <ul className="family-list">
            {lists.map((entry) => (
              <li key={entry.id} className="family-row">
                <div className="family-row-head">
                  <strong>
                    <Link href={`/kitchen/shopping?list=${entry.id}`}>{entry.title}</Link>
                  </strong>
                  {entry.done ? <span className="family-tag">erledigt</span> : null}
                  {entry.id === active?.id ? <span className="family-tag">offen</span> : null}
                  <span className="family-muted">{DATE_FORMAT.format(entry.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active ? (
        <>
          <section className="family-section">
            <h2>{active.title}</h2>
            <FamilyShoppingOffline
              listId={active.id}
              items={active.items.map((item) => ({
                id: item.id,
                name: item.name,
                checked: item.checked,
              }))}
            />
            {canPush ? (
              <div className="family-head-actions">
                <form action={syncListWithBringAction}>
                  <input type="hidden" name="listId" value={active.id} />
                  <button type="submit" className="family-btn family-btn-sm">
                    ↔ Mit Bring! abgleichen
                  </button>
                </form>
                <form action={pushListToBringAction}>
                  <input type="hidden" name="listId" value={active.id} />
                  <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                    Nur senden
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          {[...grouped.entries()].map(([category, items]) => (
            <section className="family-section" key={category}>
              <h2>
                {SHOPPING_CATEGORY_LABELS[category]} · {items.length}
              </h2>
              <ul className="family-list">
                {items.map((item) => (
                  <li key={item.id} className="family-row">
                    <div className="family-row-head">
                      <form action={toggleShoppingItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="listId" value={active.id} />
                        <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                          {item.checked ? "☑" : "☐"}
                        </button>
                      </form>
                      <span style={item.checked ? { textDecoration: "line-through" } : undefined}>
                        {item.name}
                        {item.amount != null
                          ? ` — ${formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)}`
                          : item.unitLabel
                            ? ` — ${item.unitLabel}`
                            : ""}
                      </span>
                      {item.recurring ? <span className="family-tag">Grundausstattung</span> : null}
                      <form action={removeShoppingItemAction} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="listId" value={active.id} />
                        <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                          ✕
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="family-section">
            <form action={addShoppingItemAction} className="family-form family-form-inline family-card">
              <input type="hidden" name="listId" value={active.id} />
              <label>
                Weitere Position
                <input
                  type="text"
                  name="name"
                  list="family-item-suggestions"
                  autoComplete="off"
                  placeholder="z. B. Butter"
                />
              </label>
              <button type="submit" className="family-btn family-btn-sm">
                + Hinzufügen
              </button>
            </form>
            {suggestions.length > 0 ? (
              <datalist id="family-item-suggestions">
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </section>
        </>
      ) : null}

      <section className="family-section">
        <h2>Bring!</h2>
        {bringStatus.connected ? (
          <div className="family-card family-form">
            <p className="family-muted">
              Verbunden als {bringStatus.maskedEmail}
              {bringStatus.lastSyncedAt
                ? ` · zuletzt gesendet ${DATETIME_FORMAT.format(new Date(bringStatus.lastSyncedAt))}`
                : ""}
            </p>
            {bringStatus.availableLists.length > 0 ? (
              <form action={setBringListAction} className="family-form family-form-inline">
                <label>
                  Zielliste
                  <select name="listUuid" defaultValue={bringStatus.defaultListUuid ?? ""}>
                    <option value="">— wählen —</option>
                    {bringStatus.availableLists.map((entry) => (
                      <option key={entry.listUuid} value={entry.listUuid}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="family-btn family-btn-sm">
                  Speichern
                </button>
              </form>
            ) : (
              <p className="family-muted">Keine Listen im Zwischenspeicher — lade sie neu.</p>
            )}
            <div className="family-head-actions">
              <form action={refreshBringListsAction}>
                <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                  Listen aktualisieren
                </button>
              </form>
              <form action={disconnectBringAction}>
                <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                  Bring! trennen
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="family-card family-form">
            <p className="family-muted">
              Listen direkt in die Bring!-App schicken. E-Mail und Passwort werden verschlüsselt
              gespeichert und nur zum Anmelden an der (inoffiziellen) Bring!-API benutzt.
            </p>
            <form action={connectBringAction} className="family-form">
              <div className="family-form-row">
                <label>
                  Bring!-E-Mail
                  <input type="email" name="email" autoComplete="off" required />
                </label>
                <label>
                  Passwort
                  <input type="password" name="password" autoComplete="off" required />
                </label>
              </div>
              <div>
                <button type="submit" className="family-btn family-btn-sm">
                  Verbinden
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </FamilyShell>
  );
}
