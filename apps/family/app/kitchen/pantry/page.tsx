import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createKitchenService,
  createPantryService,
  formatAmount,
  rankRecipesByPantry,
  INGREDIENT_UNITS,
  INGREDIENT_UNIT_LABELS,
  PANTRY_LOCATIONS,
  PANTRY_LOCATION_LABELS,
  type PantryLocation,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import {
  createPantryItemAction,
  markPantryLowStockAction,
  removePantryItemAction,
} from "@/app/kitchen-actions";

/**
 * Vorratskammer — was ist da, was läuft ab, und was lässt sich daraus kochen.
 *
 * Der Rezeptvorschlag rechnet rein aus dem Bestand (`rankRecipesByPantry`) und
 * ist bewusst keine KI: „drei von vier Zutaten da" ist nachvollziehbar, eine
 * Empfehlung ohne Begründung nicht.
 */

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const EXPIRY_WINDOW_DAYS = 7;

export default async function FamilyPantryPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Vorratskammer">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const pantry = createPantryService(familyPrisma);
  const kitchen = createKitchenService(familyPrisma, prisma);
  const now = new Date();

  const [items, expiring, recipes] = await Promise.all([
    pantry.list(),
    pantry.getExpiring(EXPIRY_WINDOW_DAYS, now),
    kitchen.listRecipes({ status: "active" }),
  ]);

  const expiringIds = new Set(expiring.map((item) => item.id));
  const matches = rankRecipesByPantry(
    recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients.map((ing) => ({
        normalizedName: ing.normalizedName,
        optional: ing.optional,
      })),
    })),
    items.map((item) => item.normalizedName),
  ).slice(0, 6);

  const byLocation = new Map<PantryLocation, typeof items>();
  for (const item of items) {
    const key = item.location as PantryLocation;
    byLocation.set(key, [...(byLocation.get(key) ?? []), item]);
  }

  return (
    <FamilyShell
      active="/kitchen"
      title="Vorratskammer"
      eyebrow="Küche"
      lede={`${items.length} Eintrag/Einträge. Was bald abläuft, steht oben.`}
      actions={
        <Link href="/kitchen" className="family-btn family-btn-ghost family-btn-sm">
          ← Küche
        </Link>
      }
    >
      {expiring.length > 0 ? (
        <section className="family-section">
          <h2>Bald ablaufend · {expiring.length}</h2>
          <ul className="family-list">
            {expiring.map((item) => {
              const expired = item.expiresAt != null && item.expiresAt.getTime() < now.getTime();
              return (
                <li key={item.id} className="family-callout family-callout-warn">
                  <strong>{item.name}</strong>
                  {item.expiresAt ? ` — bis ${DATE_FORMAT.format(item.expiresAt)}` : ""}
                  {expired ? " (abgelaufen)" : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="family-section">
        <h2>Koch mit dem, was da ist</h2>
        {matches.length === 0 ? (
          <p className="family-muted">
            Noch keine Treffer — sobald Vorräte erfasst sind, stehen hier passende Rezepte.
          </p>
        ) : (
          <ul className="family-list">
            {matches.map((match) => (
              <li key={match.recipe.id} className="family-row">
                <div className="family-row-head">
                  <strong>
                    <Link href={`/kitchen/recipes/${match.recipe.id}`}>{match.recipe.title}</Link>
                  </strong>
                  <span className="family-muted">
                    {match.matchCount} von {match.requiredCount}{" "}
                    {match.requiredCount === 1 ? "Zutat" : "Zutaten"} im Vorrat
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="family-section">
        <h2>Vorrat hinzufügen</h2>
        <form action={createPantryItemAction} className="family-form family-card">
          <div className="family-form-row">
            <label>
              Name
              <input name="name" required placeholder="z. B. Tomaten" />
            </label>
            <label>
              Lagerort
              <select name="location" defaultValue="pantry">
                {PANTRY_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {PANTRY_LOCATION_LABELS[location]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="family-form-row">
            <label>
              Menge
              <input name="amount" type="number" min={0} step="0.1" />
            </label>
            <label>
              Einheit
              <select name="unit" defaultValue="freeform">
                {INGREDIENT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {INGREDIENT_UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ablaufdatum
              <input name="expiresAt" type="date" />
            </label>
          </div>
          <label>
            Notiz
            <input name="notes" />
          </label>
          <div>
            <button type="submit" className="family-btn">
              Hinzufügen
            </button>
          </div>
        </form>
      </section>

      {PANTRY_LOCATIONS.map((location) => {
        const bucket = byLocation.get(location) ?? [];
        if (bucket.length === 0) return null;
        return (
          <section className="family-section" key={location}>
            <h2>
              {PANTRY_LOCATION_LABELS[location]} · {bucket.length}
            </h2>
            <ul className="family-list">
              {bucket.map((item) => {
                const expired = item.expiresAt != null && item.expiresAt.getTime() < now.getTime();
                const soon = expiringIds.has(item.id) && !expired;
                return (
                  <li key={item.id} className="family-row">
                    <div className="family-row-head">
                      <strong>{item.name}</strong>
                      {formatAmount(item.amount, item.unit, item.unitLabel) ? (
                        <span className="family-muted">
                          {formatAmount(item.amount, item.unit, item.unitLabel)}
                        </span>
                      ) : null}
                      {item.lowStock ? <span className="family-tag">knapp</span> : null}
                      {expired ? (
                        <span className="family-tag family-tag-warn">abgelaufen</span>
                      ) : soon ? (
                        <span className="family-tag family-tag-warn">bald MHD</span>
                      ) : null}
                      {item.expiresAt ? (
                        <span className="family-muted">bis {DATE_FORMAT.format(item.expiresAt)}</span>
                      ) : null}
                      <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                        <form action={markPantryLowStockAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="lowStock" value={item.lowStock ? "0" : "1"} />
                          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                            {item.lowStock ? "Vorhanden" : "Knapp"}
                          </button>
                        </form>
                        <form action={removePantryItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                            ✕
                          </button>
                        </form>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </FamilyShell>
  );
}
