import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import {
  createRollTableService,
  ROLL_TABLE_CATEGORIES,
  ROLL_TABLE_CATEGORY_LABELS,
  serializeRollTableEntries,
} from "@uwe/roll-tables";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  RollHistoryPanel,
  RollTableRollButton,
} from "@/src/components/world/RollTableRollPanel";
import {
  createRollTableAction,
  deleteRollTableAction,
  seedRollTablePresetsAction,
  updateRollTableAction,
} from "@/app/worlds/[worldSlug]/roll-table-actions";
import {
  Alert,
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
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
    seeded?: string;
  }>;
}

export default async function RollTablesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, deleted, seeded } = await searchParams;

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const tables = await createRollTableService(prisma).listForWorld(world.id);

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Zufallstabellen",
          `/worlds/${worldSlug}/roll-tables`,
        )}
      />
      <PageHeader
        title="Zufallstabellen"
        summary="Loot, Zufalls-Encounter und Namen — gewichtete Tabellen mit Würfeln-Button und Roll-Verlauf."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Roll-Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
            <RollHistoryPanel worldSlug={worldSlug} />
          </CardContent>
        </Card>

        {saved === "1" && <Alert tone="success">Tabelle gespeichert.</Alert>}
        {deleted === "1" && <Alert tone="success">Tabelle gelöscht.</Alert>}
        {seeded !== undefined && (
          <Alert tone="success">{seeded} Vorlagen-Tabelle(n) eingespielt.</Alert>
        )}

        {tables.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 pt-6">
              <p className="text-sm text-muted-foreground">
                Noch keine Tabellen. Starte mit den Vorlagen (Loot, Encounter, Tavernen- und
                NPC-Namen) oder lege unten eine eigene an.
              </p>
              <form action={seedRollTablePresetsAction}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <Button type="submit">Vorlagen einspielen</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {tables.map((table) => (
          <Card key={table.id}>
            <CardHeader>
              <CardTitle>
                {table.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({ROLL_TABLE_CATEGORY_LABELS[table.category]}
                  {table.dice ? ` · ${table.dice}` : ""} · {table.entries.length} Einträge)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {table.notes && <p className="text-sm text-muted-foreground">{table.notes}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <RollTableRollButton
                  worldSlug={worldSlug}
                  tableId={table.id}
                  tableName={table.name}
                  entries={table.entries}
                />
                <form action={deleteRollTableAction}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="tableId" value={table.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Löschen
                  </Button>
                </form>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Bearbeiten</summary>
                <form action={updateRollTableAction} className="mt-3 flex flex-col gap-4">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="tableId" value={table.id} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`table-${table.id}-name`}>Name</Label>
                    <Input id={`table-${table.id}-name`} name="name" defaultValue={table.name} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`table-${table.id}-category`}>Kategorie</Label>
                    <Select name="category" defaultValue={table.category}>
                      <SelectTrigger id={`table-${table.id}-category`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLL_TABLE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {ROLL_TABLE_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`table-${table.id}-dice`}>Würfel (optional, z. B. d20)</Label>
                    <Input id={`table-${table.id}-dice`} name="dice" defaultValue={table.dice ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`table-${table.id}-entries`}>
                      Einträge (einer pro Zeile, optional „| Gewicht“)
                    </Label>
                    <Textarea
                      id={`table-${table.id}-entries`}
                      name="entries"
                      rows={Math.min(14, table.entries.length + 2)}
                      defaultValue={serializeRollTableEntries(table.entries)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`table-${table.id}-notes`}>Notizen</Label>
                    <Input id={`table-${table.id}-notes`} name="notes" defaultValue={table.notes ?? ""} />
                  </div>
                  <div>
                    <Button type="submit" variant="secondary">
                      Speichern
                    </Button>
                  </div>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Neue Tabelle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={createRollTableAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-table-name">Name</Label>
                <Input id="new-table-name" name="name" required placeholder="z. B. Loot — Räuberlager" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-table-category">Kategorie</Label>
                <Select name="category" defaultValue="custom">
                  <SelectTrigger id="new-table-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLL_TABLE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {ROLL_TABLE_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-table-dice">Würfel (optional)</Label>
                <Input id="new-table-dice" name="dice" placeholder="d20" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-table-entries">
                  Einträge (einer pro Zeile, optional „| Gewicht“)
                </Label>
                <Textarea
                  id="new-table-entries"
                  name="entries"
                  rows={8}
                  required
                  placeholder={"Goldbeutel | 3\nRostiger Schlüssel\nHeiltrank | 2"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-table-notes">Notizen (optional)</Label>
                <Input id="new-table-notes" name="notes" />
              </div>
              <div>
                <Button type="submit">Tabelle anlegen</Button>
              </div>
            </form>
            {tables.length > 0 && (
              <form action={seedRollTablePresetsAction}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <Button type="submit" variant="ghost" size="sm">
                  Fehlende Vorlagen einspielen
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
