import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import {
  assignTreasuryItemToCharacterAction,
  returnTreasuryItemFromCharacterAction,
} from "@/app/treasury-actions";
import { PageHeader } from "@/src/components/shell";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import {
  createAuthService,
  createPartyTreasuryService,
  DEFAULT_CURRENCIES,
  type CurrencyLedger,
  type PlayerSafeInventoryItemView,
  type PortalTreasuryView,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";

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

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const selectClassName =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  const db = getSharedPrismaClient();
  let view: PortalTreasuryView | null = null;
  let ownCharacters: OwnCharacterInventory[] = [];
  const canMoveItems = Boolean(
    ctx.user && !ctx.previewAsUserId && ctx.worldMembership !== null,
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
    await disconnectPrismaClientIfOwned(db);
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
    <>
      <PageHeader
        title={view.name}
        summary="Gemeinsame Währung und Gegenstände eurer Gruppe."
        meta={
          view.updatedAt ? (
            <span className="text-sm text-muted-foreground">
              Zuletzt aktualisiert: {UPDATED_AT_FORMAT.format(new Date(view.updatedAt))}
            </span>
          ) : null
        }
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Währung</CardTitle>
          </CardHeader>
          <CardContent>
            {currencyEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Währung erfasst.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius)] border border-border">
                {currencyEntries.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.amount.toLocaleString("de-DE")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{notes}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Inventar ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Gruppengegenstände.</p>
            ) : (
              <ul className="grid gap-3">
                {items.map((item) => {
                  const valueLabel = formatItemValue(item.value);
                  return (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius)] border border-border p-4"
                    >
                      <div className="font-semibold">
                        {item.name}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </div>
                      {(valueLabel || item.weight != null) && (
                        <p className="my-1.5 text-sm text-muted-foreground">
                          {valueLabel ? `Wert: ${valueLabel}` : null}
                          {valueLabel && item.weight != null ? " · " : null}
                          {item.weight != null ? `Gewicht: ${item.weight}` : null}
                        </p>
                      )}
                      {item.notes ? (
                        <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
                      ) : null}
                      {canMoveItems && ownCharacters.length > 0 ? (
                        <form
                          action={assignTreasuryItemToCharacterAction}
                          className="mt-2 flex flex-wrap items-end gap-3"
                        >
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <div className="grid min-w-48 gap-1.5">
                            <Label htmlFor={`character-${item.id}`}>An Charakter übergeben</Label>
                            <select
                              id={`character-${item.id}`}
                              name="characterId"
                              defaultValue={ownCharacters[0]?.id}
                              className={selectClassName}
                            >
                              {ownCharacters.map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.displayName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button type="submit" size="sm">
                            Übernehmen
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {canMoveItems && ownCharacters.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Meine Charaktere</CardTitle>
              <CardDescription>Inventar deiner Charaktere und Rückgabe in die Schatzkammer.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {ownCharacters.map((character) => (
                <div key={character.id}>
                  <h3 className="mb-1.5 font-medium">{character.displayName}</h3>
                  {character.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Kein Inventar.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {character.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-[var(--radius)] border border-border p-4"
                        >
                          <div className="font-semibold">
                            {item.name}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                          </div>
                          {item.notes ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</p>
                          ) : null}
                          <form action={returnTreasuryItemFromCharacterAction} className="mt-2">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button type="submit" size="sm" variant="secondary">
                              Zurück in die Schatzkammer
                            </Button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
