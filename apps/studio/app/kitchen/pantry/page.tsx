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
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  createPantryItemAction,
  markPantryLowStockAction,
  removePantryItemAction,
} from "@/app/kitchen-actions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const EXPIRY_WINDOW_DAYS = 7;

export default async function KitchenPantryPage() {
  await requireStudioAccess();

  const pantry = createPantryService(familyPrisma);
  const kitchen = createKitchenService(familyPrisma, prisma);
  const now = new Date();

  const [items, expiring, recipes] = await Promise.all([
    pantry.list(),
    pantry.getExpiring(EXPIRY_WINDOW_DAYS, now),
    kitchen.listRecipes({ status: "active" }),
  ]);

  const pantryNames = items.map((item) => item.normalizedName);
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
    pantryNames,
  ).slice(0, 6);

  const itemsByLocation = new Map<PantryLocation, typeof items>();
  for (const item of items) {
    const key = item.location as PantryLocation;
    const bucket = itemsByLocation.get(key) ?? [];
    bucket.push(item);
    itemsByLocation.set(key, bucket);
  }

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Vorratskammer" }]}
        />
      }
    >
      <PageHeader
        title="Vorratskammer"
        summary="Was ist zuhause da? Behalte Vorräte, Lagerorte und Ablaufdaten im Blick — und koche direkt mit dem, was da ist."
      />

      <div className="flex flex-col gap-6">
        {expiring.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bald ablaufend</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {expiring.map((item) => {
                  const expired = item.expiresAt != null && item.expiresAt.getTime() < now.getTime();
                  return (
                    <li key={item.id} className="flex items-baseline gap-2">
                      <Badge variant={expired ? "danger" : "warning"}>
                        {expired ? "abgelaufen" : "bald"}
                      </Badge>
                      <span className="flex-1">
                        {item.name}
                        {item.expiresAt ? ` — ${DATE_FORMAT.format(item.expiresAt)}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Koche mit meinem Vorrat</h2>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine passenden Rezepte — lege Vorräte an, dann schlagen wir hier Gerichte vor.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {matches.map((match) => (
                <Card key={match.recipe.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/kitchen/recipes/${match.recipe.id}`}>{match.recipe.title}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {match.matchCount} von {match.requiredCount}{" "}
                      {match.requiredCount === 1 ? "Zutat" : "Zutaten"} im Vorrat
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Vorrat hinzufügen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPantryItemAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-name">Name</Label>
                <Input id="pantry-new-name" name="name" required placeholder="z. B. Tomaten" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-location">Lagerort</Label>
                <Select name="location" defaultValue="pantry">
                  <SelectTrigger id="pantry-new-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PANTRY_LOCATIONS.map((location) => (
                      <SelectItem key={location} value={location}>
                        {PANTRY_LOCATION_LABELS[location]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-amount">Menge</Label>
                <Input id="pantry-new-amount" name="amount" type="number" min={0} step="0.1" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-unit">Einheit</Label>
                <Select name="unit" defaultValue="freeform">
                  <SelectTrigger id="pantry-new-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INGREDIENT_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {INGREDIENT_UNIT_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-expires">Ablaufdatum</Label>
                <Input id="pantry-new-expires" name="expiresAt" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pantry-new-notes">Notiz</Label>
                <Input id="pantry-new-notes" name="notes" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Hinzufügen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {PANTRY_LOCATIONS.map((location) => {
          const bucket = itemsByLocation.get(location) ?? [];
          if (bucket.length === 0) {
            return null;
          }
          return (
            <section className="flex flex-col gap-3" key={location}>
              <h2 className="text-lg font-semibold tracking-tight">{PANTRY_LOCATION_LABELS[location]}</h2>
              <ul className="flex flex-col gap-2">
                {bucket.map((item) => {
                  const expired = item.expiresAt != null && item.expiresAt.getTime() < now.getTime();
                  const expiringSoon = expiringIds.has(item.id) && !expired;
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline gap-2 rounded-[var(--radius)] border border-border p-3 text-sm"
                    >
                      <span className="flex-1">
                        {[item.name, formatAmount(item.amount, item.unit, item.unitLabel)]
                          .filter(Boolean)
                          .join(" · ")}
                        {item.lowStock ? " — knapp" : ""}
                        {item.expiresAt ? ` — bis ${DATE_FORMAT.format(item.expiresAt)}` : ""}
                      </span>
                      {expired ? (
                        <Badge variant="danger">abgelaufen</Badge>
                      ) : expiringSoon ? (
                        <Badge variant="warning">bald MHD</Badge>
                      ) : null}
                      <form action={markPantryLowStockAction} className="inline">
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="lowStock" value={item.lowStock ? "0" : "1"} />
                        <Button type="submit" variant="secondary" size="sm">
                          {item.lowStock ? "Vorhanden" : "Knapp"}
                        </Button>
                      </form>
                      <form action={removePantryItemAction} className="inline">
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          ✕
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </StudioShell>
  );
}
