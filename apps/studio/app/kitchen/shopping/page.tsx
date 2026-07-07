import Link from "next/link";
import {
  createBringService,
  createShoppingService,
  formatAmount,
  SHOPPING_CATEGORY_LABELS,
  type IngredientUnit,
  type ShoppingCategory,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
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

interface Props {
  searchParams: Promise<{ list?: string; bring?: string; msg?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const DATETIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function KitchenShoppingPage({ searchParams }: Props) {
  await requireStudioAccess();
  const { list: listId, bring: bringFlag, msg } = await searchParams;

  const shopping = createShoppingService(prisma);
  const [lists, active, bringStatus, suggestions] = await Promise.all([
    shopping.listLists(),
    listId ? shopping.getList(listId) : Promise.resolve(null),
    createBringService(prisma).getStatus(),
    shopping.getItemSuggestions(),
  ]);

  const grouped = new Map<ShoppingCategory, NonNullable<typeof active>["items"]>();
  for (const item of active?.items ?? []) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  const canPush = bringStatus.connected && Boolean(bringStatus.defaultListUuid);

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Einkauf" }]}
        />
      }
    >
      <PageHeader
        title="Einkaufslisten"
        summary="Aus dem Wochenplan erzeugte, konsolidierte Listen — nach Kategorie sortiert, zum Abhaken. Optional per Bring! aufs Handy."
      />

      {bringFlag ? (
        <p
          role="status"
          className="uwe-dashboard-muted"
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            borderLeft: `3px solid ${bringFlag === "ok" ? "var(--uwe-ok, #2e7d32)" : "var(--uwe-error, #c62828)"}`,
            background: "var(--uwe-surface-muted, rgba(127,127,127,0.08))",
          }}
        >
          {msg ?? (bringFlag === "ok" ? "Bring!: erledigt." : "Bring!: Fehler.")}
        </p>
      ) : null}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Bring!-Sync</h2>
        {bringStatus.connected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p className="uwe-dashboard-muted">
              Verbunden als {bringStatus.maskedEmail}
              {bringStatus.lastSyncedAt
                ? ` · zuletzt gesendet ${DATETIME_FORMAT.format(new Date(bringStatus.lastSyncedAt))}`
                : ""}
            </p>

            {bringStatus.availableLists.length > 0 ? (
              <form action={setBringListAction} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  Zielliste
                  <select name="listUuid" defaultValue={bringStatus.defaultListUuid ?? ""}>
                    <option value="" disabled>
                      — wählen —
                    </option>
                    {bringStatus.availableLists.map((entry) => (
                      <option key={entry.listUuid} value={entry.listUuid}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                  Speichern
                </button>
              </form>
            ) : (
              <p className="uwe-dashboard-muted">
                Keine Listen im Cache — lade sie neu.
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <form action={refreshBringListsAction} style={{ display: "inline" }}>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                  Listen aktualisieren
                </button>
              </form>
              <form action={disconnectBringAction} style={{ display: "inline" }}>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                  Bring! trennen
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p className="uwe-dashboard-muted">
              Einkaufslisten direkt in die Bring!-App pushen. Melde dich mit deinem
              Bring!-Konto an — E-Mail und Passwort werden verschlüsselt gespeichert
              und nur zum Anmelden an die (inoffizielle) Bring!-API genutzt.
            </p>
            <form
              action={connectBringAction}
              style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
            >
              <input
                type="email"
                name="email"
                placeholder="Bring!-E-Mail"
                autoComplete="off"
                required
                style={{ flex: "1 1 12rem" }}
              />
              <input
                type="password"
                name="password"
                placeholder="Passwort"
                autoComplete="off"
                required
                style={{ flex: "1 1 10rem" }}
              />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                Verbinden
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Listen</h2>
        <form
          action={createManualListAction}
          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}
        >
          <input
            type="text"
            name="title"
            placeholder="Neue Liste (z. B. Wocheneinkauf) …"
            style={{ flex: "1 1 14rem" }}
          />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            + Neue Liste
          </button>
        </form>
        {lists.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Noch keine Listen. Lege oben eine manuelle Liste an oder erzeuge eine
            im <Link href="/kitchen/plan">Wochenplan</Link>.
          </p>
        ) : (
          <ul className="uwe-linked-list">
            {lists.map((entry) => (
              <li key={entry.id}>
                <Link href={`/kitchen/shopping?list=${entry.id}`}>
                  {entry.title}
                </Link>{" "}
                <span className="uwe-dashboard-muted">
                  {DATE_FORMAT.format(entry.createdAt)}
                  {entry.done ? " · erledigt" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active ? (
        <>
          <PageHeader
            title={active.title}
            actions={
              canPush ? (
                <>
                  <form action={syncListWithBringAction} style={{ display: "inline" }}>
                    <input type="hidden" name="listId" value={active.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                      ↔ Mit Bring! abgleichen
                    </button>
                  </form>
                  <form action={pushListToBringAction} style={{ display: "inline" }}>
                    <input type="hidden" name="listId" value={active.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      Nur senden
                    </button>
                  </form>
                </>
              ) : undefined
            }
          />
          {[...grouped.entries()].map(([category, items]) => (
            <section className="uwe-v2-section" key={category}>
              <h2 className="uwe-v2-section-title">{SHOPPING_CATEGORY_LABELS[category]}</h2>
              <ul className="uwe-linked-list">
                {items.map((item) => (
                  <li key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                    <form action={toggleShoppingItemAction} style={{ display: "inline" }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="listId" value={active.id} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        {item.checked ? "☑" : "☐"}
                      </button>
                    </form>
                    <span style={{ flex: 1, textDecoration: item.checked ? "line-through" : "none" }}>
                      {item.name}
                      {item.amount != null
                        ? ` — ${formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)}`
                        : item.unitLabel
                          ? ` — ${item.unitLabel}`
                          : ""}
                      {item.recurring ? " (Grundausstattung)" : ""}
                    </span>
                    <form action={removeShoppingItemAction} style={{ display: "inline" }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="listId" value={active.id} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="uwe-v2-section">
            <form action={addShoppingItemAction} style={{ display: "flex", gap: "0.5rem" }}>
              <input type="hidden" name="listId" value={active.id} />
              <input
                type="text"
                name="name"
                placeholder="Weitere Position …"
                list="uwe-item-suggestions"
                autoComplete="off"
                style={{ flex: 1 }}
              />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                + Hinzufügen
              </button>
            </form>
            {suggestions.length > 0 ? (
              <datalist id="uwe-item-suggestions">
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </section>
        </>
      ) : null}
    </StudioShell>
  );
}
