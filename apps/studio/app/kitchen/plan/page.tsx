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
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  addMealEntryAction,
  applyDraftEntryAction,
  dismissWeekDraftAction,
  generateShoppingListAction,
  removeMealEntryAction,
  suggestWeekAction,
  toggleMealCookedAction,
} from "@/app/kitchen-actions";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

interface Props {
  searchParams: Promise<{ y?: string; w?: string; ai?: string }>;
}

const AI_STATUS_MESSAGES: Record<string, string> = {
  rtx_offline: "Kein lokaler KI-Connector (RTX) online — Wochenvorschlag nicht verfügbar.",
  parse_error: "Die KI-Antwort war unlesbar. Bitte erneut versuchen.",
  ok: "KI-Wochenvorschlag erstellt — Einträge unten einzeln übernehmen.",
};

const DAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

function shiftWeek(isoYear: number, isoWeek: number, delta: number) {
  const thursday = datesOfIsoWeek(isoYear, isoWeek)[3];
  thursday.setUTCDate(thursday.getUTCDate() + delta * 7);
  return isoWeekOf(thursday);
}

export default async function KitchenPlanPage({ searchParams }: Props) {
  await requireStudioAccess();
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
    const bucket = entriesByDay.get(key) ?? [];
    bucket.push(entry);
    entriesByDay.set(key, bucket);
  }

  const prev = shiftWeek(isoYear, isoWeek, -1);
  const next = shiftWeek(isoYear, isoWeek, 1);
  const hasEntries = (week?.entries.length ?? 0) > 0;

  const aiDraft = (week?.aiDraft as WeekSuggestionDraft | null) ?? null;
  const aiMessage = ai ? AI_STATUS_MESSAGES[ai] : undefined;

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
          <>
            <form action={suggestWeekAction}>
              <input type="hidden" name="isoYear" value={isoYear} />
              <input type="hidden" name="isoWeek" value={isoWeek} />
              <Button type="submit" variant="secondary">
                KI-Wochenvorschlag
              </Button>
            </form>
            {hasEntries ? (
              <form action={generateShoppingListAction}>
                <input type="hidden" name="weekId" value={week!.id} />
                <Button type="submit">Einkaufsliste erzeugen</Button>
              </form>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {aiMessage ? (
          <p className={cn("text-sm", ai === "ok" ? "text-muted-foreground" : "text-warning")}>
            {aiMessage}
          </p>
        ) : null}

        {aiDraft && aiDraft.days.length > 0 ? (
          <Card>
            <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-2">
              <CardTitle>KI-Vorschlag (Entwurf)</CardTitle>
              <form action={dismissWeekDraftAction}>
                <input type="hidden" name="isoYear" value={isoYear} />
                <input type="hidden" name="isoWeek" value={isoWeek} />
                <Button type="submit" variant="secondary" size="sm">
                  Entwurf verwerfen
                </Button>
              </form>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {aiDraft.summary ? (
                <p className="text-sm text-muted-foreground">{aiDraft.summary}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Nichts wird automatisch übernommen — bestätige einzelne Tage.
              </p>
              <ul className="flex flex-col gap-2">
                {aiDraft.days.map((day, index) => {
                  const resolved = resolveDraftDate(day.day, days);
                  return (
                    <li key={index} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge>{DAY_FORMAT.format(resolved)}</Badge>
                      <Badge>{MEAL_SLOT_LABELS[day.slot]}</Badge>
                      <span className="flex-1">
                        {day.title}
                        {day.note ? ` — ${day.note}` : ""}
                      </span>
                      <form action={applyDraftEntryAction} className="inline">
                        <input type="hidden" name="isoYear" value={isoYear} />
                        <input type="hidden" name="isoWeek" value={isoWeek} />
                        <input type="hidden" name="date" value={resolved.toISOString()} />
                        <input type="hidden" name="slot" value={day.slot} />
                        {day.recipeId ? <input type="hidden" name="recipeId" value={day.recipeId} /> : null}
                        <input type="hidden" name="title" value={day.title} />
                        <Button type="submit" variant="secondary" size="sm">
                          + übernehmen
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/kitchen/plan?y=${prev.isoYear}&w=${prev.isoWeek}`}
            className={buttonVariants({ variant: "outline" })}
          >
            ← KW {prev.isoWeek}
          </Link>
          <Link href="/kitchen/plan" className={buttonVariants({ variant: "outline" })}>
            Diese Woche
          </Link>
          <Link
            href={`/kitchen/plan?y=${next.isoYear}&w=${next.isoWeek}`}
            className={buttonVariants({ variant: "outline" })}
          >
            KW {next.isoWeek} →
          </Link>
        </div>

        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const entries = entriesByDay.get(key) ?? [];
          return (
            <section className="flex flex-col gap-3" key={key}>
              <h2 className="text-lg font-semibold tracking-tight">{DAY_FORMAT.format(day)}</h2>
              {entries.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge>{MEAL_SLOT_LABELS[entry.slot]}</Badge>
                      <span className={cn("flex-1", entry.cooked && "line-through")}>
                        {entry.recipe ? entry.recipe.title : MEAL_ENTRY_TYPE_LABELS[entry.entryType]}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                      <form action={toggleMealCookedAction} className="inline">
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="isoYear" value={isoYear} />
                        <input type="hidden" name="isoWeek" value={isoWeek} />
                        <Button type="submit" variant="secondary" size="sm">
                          {entry.cooked ? "↺" : "✓"}
                        </Button>
                      </form>
                      <form action={removeMealEntryAction} className="inline">
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="isoYear" value={isoYear} />
                        <input type="hidden" name="isoWeek" value={isoWeek} />
                        <Button type="submit" variant="secondary" size="sm">
                          ✕
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}

              <form action={addMealEntryAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="isoYear" value={isoYear} />
                <input type="hidden" name="isoWeek" value={isoWeek} />
                <input type="hidden" name="date" value={day.toISOString()} />
                <Select name="slot" defaultValue="dinner">
                  <SelectTrigger aria-label="Mahlzeit" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {MEAL_SLOT_LABELS[slot]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                    "kein Rezept" — natives Select beibehalten, da addMealEntryAction einen
                    leeren String als "keine Auswahl" auswertet. */}
                <select
                  name="recipeId"
                  aria-label="Rezept"
                  className="h-9 w-48 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— Rezept wählen —</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.title}
                    </option>
                  ))}
                </select>
                <Input type="text" name="note" placeholder="oder Notiz / Reste" className="w-48" />
                <Button type="submit" variant="secondary">
                  + Eintrag
                </Button>
              </form>
            </section>
          );
        })}
      </div>
    </StudioShell>
  );
}
