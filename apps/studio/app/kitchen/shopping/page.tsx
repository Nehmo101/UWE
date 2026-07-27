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
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  addShoppingItemAction,
  createManualListAction,
  removeShoppingItemAction,
  toggleShoppingItemAction,
} from "@/app/kitchen-actions";
import { ShoppingListOfflinePanel } from "@/components/ShoppingListOfflinePanel";
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

  const shopping = createShoppingService(familyPrisma);
  const [lists, active, bringStatus, suggestions] = await Promise.all([
    shopping.listLists(),
    listId ? shopping.getList(listId) : Promise.resolve(null),
    createBringService(familyPrisma).getStatus(),
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

      <div className="flex flex-col gap-6">
        {bringFlag ? (
          <Alert tone={bringFlag === "ok" ? "success" : "danger"}>
            {msg ?? (bringFlag === "ok" ? "Bring!: erledigt." : "Bring!: Fehler.")}
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Bring!-Sync</CardTitle>
          </CardHeader>
          <CardContent>
            {bringStatus.connected ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Verbunden als {bringStatus.maskedEmail}
                  {bringStatus.lastSyncedAt
                    ? ` · zuletzt gesendet ${DATETIME_FORMAT.format(new Date(bringStatus.lastSyncedAt))}`
                    : ""}
                </p>

                {bringStatus.availableLists.length > 0 ? (
                  <form action={setBringListAction} className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="bring-list-uuid">Zielliste</Label>
                    <Select name="listUuid" defaultValue={bringStatus.defaultListUuid ?? ""}>
                      <SelectTrigger id="bring-list-uuid" className="w-auto min-w-48">
                        <SelectValue placeholder="— wählen —" />
                      </SelectTrigger>
                      <SelectContent>
                        {bringStatus.availableLists.map((entry) => (
                          <SelectItem key={entry.listUuid} value={entry.listUuid}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm">
                      Speichern
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine Listen im Cache — lade sie neu.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <form action={refreshBringListsAction}>
                    <Button type="submit" size="sm">
                      Listen aktualisieren
                    </Button>
                  </form>
                  <form action={disconnectBringAction}>
                    <Button type="submit" size="sm">
                      Bring! trennen
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Einkaufslisten direkt in die Bring!-App pushen. Melde dich mit deinem
                  Bring!-Konto an — E-Mail und Passwort werden verschlüsselt gespeichert
                  und nur zum Anmelden an die (inoffizielle) Bring!-API genutzt.
                </p>
                <form action={connectBringAction} className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    name="email"
                    placeholder="Bring!-E-Mail"
                    autoComplete="off"
                    required
                    className="min-w-48 flex-1"
                  />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Passwort"
                    autoComplete="off"
                    required
                    className="min-w-40 flex-1"
                  />
                  <Button type="submit" variant="secondary">
                    Verbinden
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={createManualListAction} className="flex flex-wrap gap-2">
              <Input
                type="text"
                name="title"
                placeholder="Neue Liste (z. B. Wocheneinkauf) …"
                className="min-w-56 flex-1"
              />
              <Button type="submit" variant="secondary">
                + Neue Liste
              </Button>
            </form>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Listen. Lege oben eine manuelle Liste an oder erzeuge eine
                im <Link href="/kitchen/plan">Wochenplan</Link>.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {lists.map((entry) => (
                  <li key={entry.id}>
                    <Link href={`/kitchen/shopping?list=${entry.id}`}>
                      {entry.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      {DATE_FORMAT.format(entry.createdAt)}
                      {entry.done ? " · erledigt" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {active ? (
          <>
            <PageHeader
              title={active.title}
              actions={
                canPush ? (
                  <>
                    <form action={syncListWithBringAction}>
                      <input type="hidden" name="listId" value={active.id} />
                      <Button type="submit" variant="secondary">
                        ↔ Mit Bring! abgleichen
                      </Button>
                    </form>
                    <form action={pushListToBringAction}>
                      <input type="hidden" name="listId" value={active.id} />
                      <Button type="submit" size="sm">
                        Nur senden
                      </Button>
                    </form>
                  </>
                ) : undefined
              }
            />
            <ShoppingListOfflinePanel
              listId={active.id}
              items={active.items.map((item) => ({
                id: item.id,
                name: item.name,
                checked: item.checked,
              }))}
            />
            {[...grouped.entries()].map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{SHOPPING_CATEGORY_LABELS[category]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-baseline gap-2">
                        <form action={toggleShoppingItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="listId" value={active.id} />
                          <Button type="submit" size="sm">
                            {item.checked ? "☑" : "☐"}
                          </Button>
                        </form>
                        <span className={cn("flex-1 text-sm", item.checked && "line-through")}>
                          {item.name}
                          {item.amount != null
                            ? ` — ${formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)}`
                            : item.unitLabel
                              ? ` — ${item.unitLabel}`
                              : ""}
                          {item.recurring ? " (Grundausstattung)" : ""}
                        </span>
                        <form action={removeShoppingItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="listId" value={active.id} />
                          <Button type="submit" size="sm">
                            ✕
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <form action={addShoppingItemAction} className="flex gap-2">
                  <input type="hidden" name="listId" value={active.id} />
                  <Input
                    type="text"
                    name="name"
                    placeholder="Weitere Position …"
                    list="kitchen-item-suggestions"
                    autoComplete="off"
                    className="flex-1"
                  />
                  <Button type="submit" variant="secondary">
                    + Hinzufügen
                  </Button>
                </form>
                {suggestions.length > 0 ? (
                  <datalist id="kitchen-item-suggestions">
                    {suggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </StudioShell>
  );
}
