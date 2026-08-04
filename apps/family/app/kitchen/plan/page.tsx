import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createKitchenService,
  createMealPlanService,
  datesOfIsoWeek,
  isoWeekOf,
  resolveDraftDate,
  MEAL_ENTRY_TYPE_LABELS,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  type WeekSuggestionDraft,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import {
  addMealEntryAction,
  generateShoppingListAction,
  removeMealEntryAction,
  toggleMealCookedAction,
} from "@/app/kitchen-actions";
import {
  adoptDraftRecipeAction,
  applyDraftEntryAction,
  dismissWeekDraftAction,
  suggestWeekAction,
} from "@/app/kitchen-plan-actions";

/**
 * Wochenplan — pro Tag planen, abhaken, und daraus eine Einkaufsliste ziehen.
 *
 * Der KI-Vorschlag läuft über den Maschinenraum-Host und wird nie automatisch übernommen:
 * er landet als Entwurf auf der Woche, und jeder Tag wird einzeln bestätigt.
 * Ohne lokalen Connector gibt es schlicht keinen Vorschlag — kein Cloud-Weg.
 */

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ y?: string; w?: string; ai?: string }>;
}

const AI_STATUS_MESSAGES: Record<string, string> = {
  engine_offline: "Kein lokaler KI-Connector (Maschinenraum) online — Wochenvorschlag nicht verfügbar.",
  parse_error: "Die KI-Antwort war unlesbar. Bitte erneut versuchen.",
  ok: "KI-Wochenvorschlag erstellt — Einträge unten einzeln übernehmen.",
  adopted: "Gericht als Rezept-Entwurf übernommen und eingeplant — Details unter Rezepte.",
};

const DAY_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

function shiftWeek(isoYear: number, isoWeek: number, delta: number) {
  const thursday = datesOfIsoWeek(isoYear, isoWeek)[3];
  thursday.setUTCDate(thursday.getUTCDate() + delta * 7);
  return isoWeekOf(thursday);
}

export default async function FamilyMealPlanPage({ searchParams }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Wochenplan">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { y, w, ai } = await searchParams;
  const now = isoWeekOf(new Date());
  const isoYear = Number.parseInt(y || "", 10) || now.isoYear;
  const isoWeek = Number.parseInt(w || "", 10) || now.isoWeek;

  const meals = createMealPlanService(familyPrisma);
  const kitchen = createKitchenService(familyPrisma, prisma);
  const [week, recipes] = await Promise.all([
    meals.getWeek(isoYear, isoWeek),
    kitchen.listRecipes({ status: "active" }),
  ]);

  const days = datesOfIsoWeek(isoYear, isoWeek);
  const entriesByDay = new Map<string, NonNullable<typeof week>["entries"]>();
  for (const entry of week?.entries ?? []) {
    const key = new Date(entry.date).toISOString().slice(0, 10);
    entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
  }

  const prev = shiftWeek(isoYear, isoWeek, -1);
  const next = shiftWeek(isoYear, isoWeek, 1);
  const hasEntries = (week?.entries.length ?? 0) > 0;
  const aiDraft = (week?.aiDraft as WeekSuggestionDraft | null) ?? null;
  const aiMessage = ai ? AI_STATUS_MESSAGES[ai] : undefined;

  return (
    <FamilyShell
      active="/kitchen"
      title={`Wochenplan · KW ${isoWeek}/${isoYear}`}
      eyebrow="Küche"
      lede="Mahlzeiten pro Tag, daraus eine konsolidierte Einkaufsliste."
      actions={
        <span className="family-head-actions">
          <Link href="/kitchen" className="family-btn family-btn-ghost family-btn-sm">
            ← Küche
          </Link>
          <form action={suggestWeekAction}>
            <input type="hidden" name="isoYear" value={isoYear} />
            <input type="hidden" name="isoWeek" value={isoWeek} />
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
              KI-Vorschlag
            </button>
          </form>
          {hasEntries ? (
            <form action={generateShoppingListAction}>
              <input type="hidden" name="weekId" value={week!.id} />
              <button type="submit" className="family-btn family-btn-sm">
                Einkaufsliste erzeugen
              </button>
            </form>
          ) : null}
        </span>
      }
    >
      {aiMessage ? (
        <p className={ai === "ok" ? "family-callout" : "family-callout family-callout-warn"}>
          {aiMessage}
        </p>
      ) : null}

      {aiDraft && aiDraft.days.length > 0 ? (
        <section className="family-section">
          <h2>KI-Vorschlag (Entwurf)</h2>
          {aiDraft.summary ? <p className="family-muted">{aiDraft.summary}</p> : null}
          <p className="family-muted">
            Nichts wird automatisch übernommen — bestätige einzelne Tage.
          </p>
          <ul className="family-list">
            {aiDraft.days.map((day, index) => {
              const resolved = resolveDraftDate(day.day, days);
              return (
                <li key={index} className="family-row">
                  <div className="family-row-head">
                    <span className="family-tag">{DAY_FORMAT.format(resolved)}</span>
                    <span className="family-tag">{MEAL_SLOT_LABELS[day.slot]}</span>
                    {day.invented ? <span className="family-tag">Neu (KI)</span> : null}
                    <span>
                      {day.title}
                      {day.note ? ` — ${day.note}` : ""}
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                      {day.invented ? (
                        <form action={adoptDraftRecipeAction}>
                          <input type="hidden" name="isoYear" value={isoYear} />
                          <input type="hidden" name="isoWeek" value={isoWeek} />
                          <input type="hidden" name="draftIndex" value={index} />
                          <button type="submit" className="family-btn family-btn-sm">
                            Als Rezept übernehmen
                          </button>
                        </form>
                      ) : null}
                      <form action={applyDraftEntryAction}>
                        <input type="hidden" name="isoYear" value={isoYear} />
                        <input type="hidden" name="isoWeek" value={isoWeek} />
                        <input type="hidden" name="date" value={resolved.toISOString()} />
                        <input type="hidden" name="slot" value={day.slot} />
                        {day.recipeId ? (
                          <input type="hidden" name="recipeId" value={day.recipeId} />
                        ) : null}
                        <input type="hidden" name="title" value={day.title} />
                        <button type="submit" className="family-btn family-btn-sm">
                          + übernehmen
                        </button>
                      </form>
                    </span>
                  </div>
                  {day.invented && day.ingredients && day.ingredients.length > 0 ? (
                    <p className="family-muted">Zutaten: {day.ingredients.join(", ")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <form action={dismissWeekDraftAction}>
            <input type="hidden" name="isoYear" value={isoYear} />
            <input type="hidden" name="isoWeek" value={isoWeek} />
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
              Entwurf verwerfen
            </button>
          </form>
        </section>
      ) : null}

      <nav className="family-head-actions" aria-label="Woche">
        <Link
          href={`/kitchen/plan?y=${prev.isoYear}&w=${prev.isoWeek}`}
          className="family-btn family-btn-ghost family-btn-sm"
        >
          ← KW {prev.isoWeek}
        </Link>
        <Link href="/kitchen/plan" className="family-btn family-btn-ghost family-btn-sm">
          Diese Woche
        </Link>
        <Link
          href={`/kitchen/plan?y=${next.isoYear}&w=${next.isoWeek}`}
          className="family-btn family-btn-ghost family-btn-sm"
        >
          KW {next.isoWeek} →
        </Link>
      </nav>

      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const entries = entriesByDay.get(key) ?? [];
        return (
          <section className="family-section" key={key}>
            <h2>{DAY_FORMAT.format(day)}</h2>
            {entries.length > 0 ? (
              <ul className="family-list">
                {entries.map((entry) => (
                  <li key={entry.id} className="family-row">
                    <div className="family-row-head">
                      <span className="family-tag">{MEAL_SLOT_LABELS[entry.slot]}</span>
                      <span style={entry.cooked ? { textDecoration: "line-through" } : undefined}>
                        {entry.recipe ? entry.recipe.title : MEAL_ENTRY_TYPE_LABELS[entry.entryType]}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                        <form action={toggleMealCookedAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="isoYear" value={isoYear} />
                          <input type="hidden" name="isoWeek" value={isoWeek} />
                          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                            {entry.cooked ? "↺" : "✓"}
                          </button>
                        </form>
                        <form action={removeMealEntryAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="isoYear" value={isoYear} />
                          <input type="hidden" name="isoWeek" value={isoWeek} />
                          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                            ✕
                          </button>
                        </form>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <form action={addMealEntryAction} className="family-form family-card">
              <input type="hidden" name="isoYear" value={isoYear} />
              <input type="hidden" name="isoWeek" value={isoWeek} />
              <input type="hidden" name="date" value={day.toISOString()} />
              <div className="family-form-row">
                <label>
                  Mahlzeit
                  <select name="slot" defaultValue="dinner">
                    {MEAL_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {MEAL_SLOT_LABELS[slot]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rezept
                  <select name="recipeId" defaultValue="">
                    <option value="">— keins —</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  oder Notiz
                  <input type="text" name="note" placeholder="z. B. Reste" />
                </label>
              </div>
              <div>
                <button type="submit" className="family-btn family-btn-sm">
                  + Eintrag
                </button>
              </div>
            </form>
          </section>
        );
      })}
    </FamilyShell>
  );
}
