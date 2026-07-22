import Link from "next/link";
import {
  createLifeAdminService,
  formatChecklistForForm,
  formatEuroFromCents,
  prisma,
  WORKSHOP_RENTAL_STATUS_LABELS,
  WorkshopRentalStatusEnum,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  StudioShell,
  PageHeader,
  BreadcrumbTrail,
} from "@/src/components/shell";
import {
  parseRentalReturnDue,
  stripRentalReturnDue,
} from "@/src/lib/workshop-rental-due";
import {
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
import {
  createTerrainRentalAction,
  deleteTerrainRentalAction,
  updateTerrainRentalAction,
} from "../../workshop-actions";

const LIST_CARD_CLASS =
  "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm";

function euroDefault(cents: number | null | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

export default async function WorkshopRentalPage() {
  const rentals = await createLifeAdminService(
    brainPrisma,
    prisma,
  ).listWorkshopTerrainRentals({ limit: 200 });

  const availability = Object.values(WorkshopRentalStatusEnum).map(
    (status) => ({
      status,
      count: rentals.filter((rental) => rental.status === status).length,
    }),
  );

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Werkstatt", href: "/workshop" },
            { label: "Terrain-Verleih" },
          ]}
        />
      }
    >
      <PageHeader
        title="Terrain-Verleih"
        summary="Sets, Kisten, Kaution und Übergabe-Checklisten — optional für Ausleihe an Spieler."
        actions={
          <Link
            href="/api/workshop/rental/ics"
            className={buttonVariants({ variant: "secondary" })}
          >
            Rückgaben (.ics)
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Verfügbarkeit</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {availability.map(({ status, count }) => (
              <Badge key={status} variant="default">
                {WORKSHOP_RENTAL_STATUS_LABELS[status]}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Bestand ({rentals.length})
          </h2>
          {rentals.length === 0 ? (
            <EmptyState
              title="Noch keine Verleih-Sets"
              description="Lege Terrain-Sets mit Kisten und Checklisten an, wenn du verleihen möchtest."
            />
          ) : (
            <ul className="grid gap-2">
              {rentals.map((rental) => {
                const returnDueAt = parseRentalReturnDue(rental.notes);
                const userNotes = stripRentalReturnDue(rental.notes);
                return (
                  <li key={rental.id} className={LIST_CARD_CLASS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{rental.terrainSetName}</strong>
                      <Badge variant="default">
                        {WORKSHOP_RENTAL_STATUS_LABELS[rental.status]}
                      </Badge>
                      {rental.boxLabel && (
                        <span className="text-sm text-muted-foreground">
                          Kiste {rental.boxLabel}
                        </span>
                      )}
                      {returnDueAt && (
                        <span className="text-sm text-muted-foreground">
                          Rückgabe bis {returnDueAt}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">
                      Miete{" "}
                      {rental.rentalPriceCents != null
                        ? formatEuroFromCents(rental.rentalPriceCents)
                        : "—"}
                      {" · "}Kaution{" "}
                      {rental.depositCents != null
                        ? formatEuroFromCents(rental.depositCents)
                        : "—"}
                      {rental.replacementValueCents != null
                        ? ` · Ersatzwert ${formatEuroFromCents(rental.replacementValueCents)}`
                        : ""}
                    </p>
                    {rental.damages.trim() && (
                      <p className="text-sm">Schäden: {rental.damages}</p>
                    )}
                    {userNotes.trim() && <p className="text-sm">{userNotes}</p>}
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        Bearbeiten
                      </summary>
                      <form
                        action={updateTerrainRentalAction}
                        className="mt-3 flex flex-col gap-3"
                      >
                        <input type="hidden" name="id" value={rental.id} />
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`rental-${rental.id}-terrain-set-name`}
                          >
                            Terrain-Set
                          </Label>
                          <Input
                            id={`rental-${rental.id}-terrain-set-name`}
                            name="terrainSetName"
                            defaultValue={rental.terrainSetName}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-box-label`}>
                            Kiste
                          </Label>
                          <Input
                            id={`rental-${rental.id}-box-label`}
                            name="boxLabel"
                            defaultValue={rental.boxLabel}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-return-due`}>
                            Rückgabe bis
                          </Label>
                          <Input
                            id={`rental-${rental.id}-return-due`}
                            name="returnDueAt"
                            type="date"
                            defaultValue={returnDueAt ?? ""}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`rental-${rental.id}-replacement-value`}
                          >
                            Ersatzwert (€)
                          </Label>
                          <Input
                            id={`rental-${rental.id}-replacement-value`}
                            name="replacementValueEuros"
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={euroDefault(
                              rental.replacementValueCents,
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-rental-price`}>
                            Mietpreis (€)
                          </Label>
                          <Input
                            id={`rental-${rental.id}-rental-price`}
                            name="rentalPriceEuros"
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={euroDefault(rental.rentalPriceCents)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-deposit`}>
                            Kaution (€)
                          </Label>
                          <Input
                            id={`rental-${rental.id}-deposit`}
                            name="depositEuros"
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={euroDefault(rental.depositCents)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-status`}>
                            Status
                          </Label>
                          <Select name="status" defaultValue={rental.status}>
                            <SelectTrigger id={`rental-${rental.id}-status`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(WorkshopRentalStatusEnum).map(
                                (status) => (
                                  <SelectItem key={status} value={status}>
                                    {WORKSHOP_RENTAL_STATUS_LABELS[status]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-damages`}>
                            Schäden
                          </Label>
                          <Textarea
                            id={`rental-${rental.id}-damages`}
                            name="damages"
                            rows={2}
                            defaultValue={rental.damages}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-handover`}>
                            Übergabe
                          </Label>
                          <Textarea
                            id={`rental-${rental.id}-handover`}
                            name="handoverChecklist"
                            rows={3}
                            defaultValue={formatChecklistForForm(
                              rental.handoverChecklist,
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`rental-${rental.id}-return-checklist`}
                          >
                            Rückgabe
                          </Label>
                          <Textarea
                            id={`rental-${rental.id}-return-checklist`}
                            name="returnChecklist"
                            rows={3}
                            defaultValue={formatChecklistForForm(
                              rental.returnChecklist,
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rental-${rental.id}-notes`}>
                            Notizen
                          </Label>
                          <Textarea
                            id={`rental-${rental.id}-notes`}
                            name="notes"
                            rows={2}
                            defaultValue={userNotes}
                          />
                        </div>
                        <div>
                          <Button type="submit" variant="secondary" size="sm">
                            Speichern
                          </Button>
                        </div>
                      </form>
                    </details>
                    <form action={deleteTerrainRentalAction}>
                      <input type="hidden" name="id" value={rental.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Löschen
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <details
          className="rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm"
          open={rentals.length === 0}
        >
          <summary className="cursor-pointer font-semibold">
            + Neues Terrain-Set
          </summary>
          <form
            action={createTerrainRentalAction}
            className="mt-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-terrain-set-name">Terrain-Set</Label>
              <Input
                id="rental-new-terrain-set-name"
                name="terrainSetName"
                required
                placeholder="z. B. Wald-Ruinen Komplett"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-box-label">Kiste/Box</Label>
              <Input
                id="rental-new-box-label"
                name="boxLabel"
                placeholder="Box A3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-return-due">Rückgabe bis</Label>
              <Input
                id="rental-new-return-due"
                name="returnDueAt"
                type="date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-replacement-value">
                Ersatzwert (€)
              </Label>
              <Input
                id="rental-new-replacement-value"
                name="replacementValueEuros"
                type="number"
                step="0.01"
                min={0}
                placeholder="z. B. 120,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-rental-price">Mietpreis (€)</Label>
              <Input
                id="rental-new-rental-price"
                name="rentalPriceEuros"
                type="number"
                step="0.01"
                min={0}
                placeholder="z. B. 15,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-deposit">Kaution (€)</Label>
              <Input
                id="rental-new-deposit"
                name="depositEuros"
                type="number"
                step="0.01"
                min={0}
                placeholder="z. B. 50,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-status">Status</Label>
              <Select name="status" defaultValue="available">
                <SelectTrigger id="rental-new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(WorkshopRentalStatusEnum).map((status) => (
                    <SelectItem key={status} value={status}>
                      {WORKSHOP_RENTAL_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-damages">Schäden</Label>
              <Textarea id="rental-new-damages" name="damages" rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-handover">
                Übergabe-Checkliste ([x] erledigt)
              </Label>
              <Textarea
                id="rental-new-handover"
                name="handoverChecklist"
                rows={3}
                placeholder={
                  "[ ] Alle Teile gezählt\n[ ] Transportkiste intakt"
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-return-checklist">
                Rückgabe-Checkliste
              </Label>
              <Textarea
                id="rental-new-return-checklist"
                name="returnChecklist"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rental-new-notes">Notizen</Label>
              <Textarea id="rental-new-notes" name="notes" rows={2} />
            </div>
            <div>
              <Button type="submit">Set anlegen</Button>
            </div>
          </form>
        </details>
      </div>
    </StudioShell>
  );
}
