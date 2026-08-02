import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createCharacterService,
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  getAppRepository,
  getInventoryItemDmNotes,
  isInventoryItemDmOnly,
  type CurrencyLedger,
} from "@uwe/database/server";
import {
  addPartyInventoryItemAction,
  assignPartyItemToCharacterAction,
  deletePartyInventoryItemAction,
  returnPartyItemToTreasuryAction,
  updatePartyTreasuryAction,
} from "@/app/worlds/[worldSlug]/treasury-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ saved?: string; added?: string; deleted?: string; moved?: string }>;
}

const CURRENCY_LABELS: Record<keyof typeof DEFAULT_CURRENCIES, string> = {
  cp: "Kupfer (cp)",
  sp: "Silber (sp)",
  ep: "Elektron (ep)",
  gp: "Gold (gp)",
  pp: "Platin (pp)",
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

export default async function WorldTreasuryPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, added, deleted, moved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const treasuryService = createPartyTreasuryService(db);
  const treasury = await treasuryService.getOrCreateForWorld(world.id);
  const characterService = createCharacterService(db);
  const characters = await characterService.listForWorld(world.id);
  const characterItems = await treasuryService.listItemsHeldByCharacters(world.id);
  await db.$disconnect();

  const currencies = parseCurrencyLedger(treasury.currencies);
  const items = treasury.items;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Gruppenschatz",
          `/worlds/${worldSlug}/treasury`,
        )}
      />
      <ShellContextPanel>
        <SidebarSection title="Gruppenschatz">
          <p className="text-sm text-muted-foreground">
            Gemeinsame Währung und Gegenstände der Gruppe — im Portal für Spieler sichtbar.
            &bdquo;Nur DM&ldquo;-Items und DM-Notizen bleiben im Studio.
          </p>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Gruppenschatz"
        summary="Verwalte Gruppenwährung und gemeinsames Inventar dieser Welt."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loot &amp; Zufall</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Ein integrierter Loot-Generator ist geplant. Bis dahin kannst du Beute über
              Zufallstabellen würfeln und Gegenstände manuell oder per Import erfassen.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/worlds/${worldSlug}/roll-tables`} className={buttonVariants({ variant: "default" })}>
                Zufallstabellen öffnen
              </Link>
              <Link href={`/worlds/${worldSlug}/magic-items`} className={buttonVariants({ variant: "outline" })}>
                Magic-Item-Werkbank
              </Link>
            </div>
          </CardContent>
        </Card>

        {saved === "1" && <Alert tone="success">Gruppenschatz gespeichert.</Alert>}
        {added === "1" && <Alert tone="success">Gegenstand hinzugefügt.</Alert>}
        {deleted === "1" && <Alert tone="success">Gegenstand entfernt.</Alert>}
        {moved === "1" && <Alert tone="success">Gegenstand verschoben.</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Währung &amp; Notizen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePartyTreasuryAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="treasury-name">Bezeichnung</Label>
                <Input id="treasury-name" name="name" defaultValue={treasury.name} required />
              </div>

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Währung</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-4">
                  {(Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[]).map((key) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label htmlFor={`treasury-currency-${key}`}>{CURRENCY_LABELS[key]}</Label>
                      <Input
                        id={`treasury-currency-${key}`}
                        name={`currency_${key}`}
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={currencies[key]}
                        required
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="treasury-notes">Notizen</Label>
                <Textarea id="treasury-notes" name="notes" rows={3} defaultValue={treasury.notes} />
              </div>

              <div>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gegenstand hinzufügen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addPartyInventoryItemAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-name">Name</Label>
                <Input id="item-name" name="name" required />
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="item-quantity">Anzahl</Label>
                  <Input id="item-quantity" name="quantity" type="number" min={1} defaultValue={1} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="item-weight">Gewicht (optional)</Label>
                  <Input id="item-weight" name="weight" type="number" min={0} step={0.1} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="item-value">Wert in GP (optional)</Label>
                  <Input id="item-value" name="valueGp" type="number" min={0} step={1} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-notes">Notizen (für Spieler sichtbar)</Label>
                <Textarea id="item-notes" name="notes" rows={2} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-dm-notes">DM-Notizen (nie im Portal sichtbar)</Label>
                <Textarea id="item-dm-notes" name="dmNotes" rows={2} />
              </div>

              {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="dmOnly" className="size-4 rounded border-input" />
                Nur für DM sichtbar (verstecktes Artefakt)
              </label>

              <div>
                <Button type="submit">Hinzufügen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Inventar ({items.length})</h2>
          {items.length === 0 ? (
            <EmptyState title="Noch keine Gegenstände" description="Noch keine Gruppengegenstände erfasst." />
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const valueLabel = formatItemValue(item.value);
                const dmNotes = getInventoryItemDmNotes(item);
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {item.name}
                        {item.quantity > 1 ? (
                          <span className="font-normal text-muted-foreground">× {item.quantity}</span>
                        ) : null}
                        {isInventoryItemDmOnly(item) && <Badge variant="warning">Nur DM</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {(valueLabel || item.weight != null) && (
                        <p className="text-sm text-muted-foreground">
                          {valueLabel ? `Wert: ${valueLabel}` : null}
                          {valueLabel && item.weight != null ? " · " : null}
                          {item.weight != null ? `Gewicht: ${item.weight}` : null}
                        </p>
                      )}
                      {item.notes && <p className="text-sm">{item.notes}</p>}
                      {dmNotes && (
                        <p className="text-sm text-muted-foreground">DM-Notizen: {dmNotes}</p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {characters.length > 0 && (
                          <form
                            action={assignPartyItemToCharacterAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <Select name="characterId" defaultValue={characters[0]?.id}>
                              <SelectTrigger className="h-8 w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {characters.map((character) => (
                                  <SelectItem key={character.id} value={character.id}>
                                    {character.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="submit" variant="ghost" size="sm">
                              Charakter zuweisen
                            </Button>
                          </form>
                        )}
                        <form action={deletePartyInventoryItemAction}>
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Entfernen
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Bei Charakteren ({characterItems.length})</h2>
          {characterItems.length === 0 ? (
            <EmptyState
              title="Keine Gegenstände bei Charakteren"
              description="Aktuell trägt kein Charakter Gegenstände aus der Schatzkammer."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {characterItems.map((item) => {
                const dmNotes = getInventoryItemDmNotes(item);
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {item.name}
                        {item.quantity > 1 ? (
                          <span className="font-normal text-muted-foreground">× {item.quantity}</span>
                        ) : null}
                        <span className="font-normal text-muted-foreground">
                          — {item.character?.displayName ?? "Unbekannter Charakter"}
                        </span>
                        {isInventoryItemDmOnly(item) && <Badge variant="warning">Nur DM</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {item.notes && <p className="text-sm">{item.notes}</p>}
                      {dmNotes && (
                        <p className="text-sm text-muted-foreground">DM-Notizen: {dmNotes}</p>
                      )}
                      <form action={returnPartyItemToTreasuryAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Zurück in die Schatzkammer
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
