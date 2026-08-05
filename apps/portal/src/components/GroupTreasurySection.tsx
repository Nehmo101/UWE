import {
  addGroupTreasuryItemAction,
  removeGroupTreasuryItemAction,
  updateGroupTreasuryAction,
  updateGroupTreasuryItemAction,
} from "@/app/treasury-actions";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input, Textarea } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  TREASURY_CURRENCIES,
  TREASURY_CURRENCY_LABELS,
  type ViewerGroupTreasury,
} from "@uwe/player-hub";

interface Props {
  worldSlug: string;
  view: ViewerGroupTreasury;
}

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Der Schatz der eigenen Tischrunde — von den Spielern selbst geführt.
 *
 * Münzen als fünf Zahlenfelder (Platin bis Kupfer), Gegenstände als Liste mit
 * Ändern und Streichen, dazu eine gemeinsame Notiz. Alles klassische Formulare
 * ohne Client-Zustand: gespeichert wird absolut, nicht als Differenz — wer
 * 250 Gold eintippt, meint 250 Gold.
 *
 * `canEdit` kommt aus dem Service, nicht aus der Seite: Vorschau-als-Spieler
 * und Konten ohne Welt-Zuordnung lesen nur.
 */
export function GroupTreasurySection({ worldSlug, view }: Props) {
  const { group, treasury, canEdit } = view;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Kasse — {group.name}</CardTitle>
          <CardDescription>
            Eure Runde führt den Schatz selbst.
            {treasury.updatedAt
              ? ` Zuletzt aktualisiert: ${UPDATED_AT_FORMAT.format(new Date(treasury.updatedAt))}`
              : " Noch leer — tragt die erste Beute ein."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <form action={updateGroupTreasuryAction} className="grid gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {TREASURY_CURRENCIES.map((key) => (
                  <div key={key} className="grid gap-1.5">
                    <Label htmlFor={`currency-${key}`}>{TREASURY_CURRENCY_LABELS[key]}</Label>
                    <Input
                      id={`currency-${key}`}
                      name={`currency_${key}`}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={treasury.currencies[key]}
                      inputMode="numeric"
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="treasury-notes">Gemeinsame Notiz</Label>
                <Textarea
                  id="treasury-notes"
                  name="notes"
                  rows={3}
                  defaultValue={treasury.notes}
                  placeholder="Wem schulden wir noch was? Was ist verpfändet?"
                />
              </div>
              <div>
                <Button type="submit">Kasse speichern</Button>
              </div>
            </form>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-[var(--radius)] border border-border">
                {TREASURY_CURRENCIES.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <strong>{TREASURY_CURRENCY_LABELS[key]}</strong>
                    <span>{treasury.currencies[key].toLocaleString("de-DE")}</span>
                  </li>
                ))}
              </ul>
              {treasury.notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm">{treasury.notes}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beute ({treasury.items.length})</CardTitle>
          <CardDescription>
            Was die Runde trägt — selbst aufgeschrieben, selbst gepflegt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {treasury.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch nichts eingetragen.</p>
          ) : (
            <ul className="grid gap-3">
              {treasury.items.map((item) => (
                <li key={item.id} className="rounded-[var(--radius)] border border-border p-4">
                  {canEdit ? (
                    <>
                      <form
                        action={updateGroupTreasuryItemAction}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <div className="grid min-w-40 flex-1 gap-1.5">
                          <Label htmlFor={`item-name-${item.id}`}>Gegenstand</Label>
                          <Input id={`item-name-${item.id}`} name="name" defaultValue={item.name} required />
                        </div>
                        <div className="grid w-24 gap-1.5">
                          <Label htmlFor={`item-quantity-${item.id}`}>Anzahl</Label>
                          <Input
                            id={`item-quantity-${item.id}`}
                            name="quantity"
                            type="number"
                            min={1}
                            step={1}
                            defaultValue={item.quantity}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="grid min-w-48 flex-1 gap-1.5">
                          <Label htmlFor={`item-notes-${item.id}`}>Notiz</Label>
                          <Input id={`item-notes-${item.id}`} name="notes" defaultValue={item.notes} />
                        </div>
                        <Button type="submit" size="sm" variant="secondary">
                          Ändern
                        </Button>
                      </form>
                      <form action={removeGroupTreasuryItemAction} className="mt-2">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Streichen
                        </Button>
                      </form>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">
                        {item.name}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </div>
                      {item.notes ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit ? (
            <form
              action={addGroupTreasuryItemAction}
              className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-dashed border-border p-4"
            >
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="grid min-w-40 flex-1 gap-1.5">
                <Label htmlFor="new-item-name">Neuer Gegenstand</Label>
                <Input id="new-item-name" name="name" placeholder="z. B. Alter Schlüssel aus der Krypta" required />
              </div>
              <div className="grid w-24 gap-1.5">
                <Label htmlFor="new-item-quantity">Anzahl</Label>
                <Input
                  id="new-item-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={1}
                  inputMode="numeric"
                />
              </div>
              <div className="grid min-w-48 flex-1 gap-1.5">
                <Label htmlFor="new-item-notes">Notiz</Label>
                <Input id="new-item-notes" name="notes" placeholder="Woher, wofür, wem versprochen…" />
              </div>
              <Button type="submit" size="sm">
                Eintragen
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
