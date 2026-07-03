import Link from "next/link";
import {
  createKitchenService,
  createMealPlanService,
  datesOfIsoWeek,
  isoWeekOf,
  MEAL_ENTRY_TYPE_LABELS,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  addMealEntryAction,
  generateShoppingListAction,
  removeMealEntryAction,
  toggleMealCookedAction,
} from "@/app/kitchen-actions";

interface Props {
  searchParams: Promise<{ y?: string; w?: string }>;
}

const DAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

function shiftWeek(isoYear: number, isoWeek: number, delta: number) {
  const thursday = datesOfIsoWeek(isoYear, isoWeek)[3];
  thursday.setUTCDate(thursday.getUTCDate() + delta * 7);
  return isoWeekOf(thursday);
}

export default async function KitchenPlanPage({ searchParams }: Props) {
  await requireStudioAccess();
  const { y, w } = await searchParams;

  const now = isoWeekOf(new Date());
  const isoYear = Number.parseInt(y || "", 10) || now.isoYear;
  const isoWeek = Number.parseInt(w || "", 10) || now.isoWeek;

  const meals = createMealPlanService(prisma);
  const kitchen = createKitchenService(prisma);
  const [week, recipes] = await Promise.all([
    meals.getWeek(isoYear, isoWeek),
    kitchen.listRecipes({ status: "active" }),
  ]);

  const days = datesOfIsoWeek(isoYear, isoWeek);
  const entriesByDay = new Map<string, NonNullable<typeof week>["entries"]>();
  for (const entry of week?.entries ?? []) {
    const key = new Date(entry.date).toISOString().slice(0, 10);
    const bucket = entriesByDay.get(key) ?? [];
    bucket.push(entry);
    entriesByDay.set(key, bucket);
  }

  const prev = shiftWeek(isoYear, isoWeek, -1);
  const next = shiftWeek(isoYear, isoWeek, 1);
  const hasEntries = (week?.entries.length ?? 0) > 0;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Wochenplan" }]}
        />
      }
    >
      <PageHeader
        title={`Wochenplan · KW ${isoWeek}/${isoYear}`}
        summary="Plane Mahlzeiten pro Tag und erzeuge daraus eine konsolidierte Einkaufsliste."
        actions={
          hasEntries ? (
            <form action={generateShoppingListAction}>
              <input type="hidden" name="weekId" value={week!.id} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Einkaufsliste erzeugen
              </button>
            </form>
          ) : null
        }
      />

      <div className="uwe-form-actions">
        <Link href={`/kitchen/plan?y=${prev.isoYear}&w=${prev.isoWeek}`} className="uwe-v2-btn">
          ← KW {prev.isoWeek}
        </Link>
        <Link href="/kitchen/plan" className="uwe-v2-btn">
          Diese Woche
        </Link>
        <Link href={`/kitchen/plan?y=${next.isoYear}&w=${next.isoWeek}`} className="uwe-v2-btn">
          KW {next.isoWeek} →
        </Link>
      </div>

      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const entries = entriesByDay.get(key) ?? [];
        return (
          <section className="uwe-v2-section" key={key}>
            <h2 className="uwe-v2-section-title">{DAY_FORMAT.format(day)}</h2>
            {entries.length > 0 ? (
              <ul className="uwe-linked-list">
                {entries.map((entry) => (
                  <li key={entry.id} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                    <span className="uwe-badge">{MEAL_SLOT_LABELS[entry.slot]}</span>
                    <span style={{ flex: 1, textDecoration: entry.cooked ? "line-through" : "none" }}>
                      {entry.recipe ? entry.recipe.title : MEAL_ENTRY_TYPE_LABELS[entry.entryType]}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </span>
                    <form action={toggleMealCookedAction} style={{ display: "inline" }}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="isoYear" value={isoYear} />
                      <input type="hidden" name="isoWeek" value={isoWeek} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        {entry.cooked ? "↺" : "✓"}
                      </button>
                    </form>
                    <form action={removeMealEntryAction} style={{ display: "inline" }}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="isoYear" value={isoYear} />
                      <input type="hidden" name="isoWeek" value={isoWeek} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}

            <form action={addMealEntryAction} className="uwe-inline-form" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input type="hidden" name="isoYear" value={isoYear} />
              <input type="hidden" name="isoWeek" value={isoWeek} />
              <input type="hidden" name="date" value={day.toISOString()} />
              <select name="slot" defaultValue="dinner" aria-label="Mahlzeit">
                {MEAL_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {MEAL_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
              <select name="recipeId" aria-label="Rezept" style={{ minWidth: "12rem" }}>
                <option value="">— Rezept wählen —</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </select>
              <input type="text" name="note" placeholder="oder Notiz / Reste" />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                + Eintrag
              </button>
            </form>
          </section>
        );
      })}
    </StudioShell>
  );
}
