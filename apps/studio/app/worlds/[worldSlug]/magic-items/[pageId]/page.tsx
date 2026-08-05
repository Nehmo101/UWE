import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildPageUrl,
  createCharacterService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { createMagicItemService } from "@uwe/database/magic-item-service";
import {
  ITEM_RARITIES,
  ITEM_RARITY_LABELS,
  toFiveToolsJson,
  toHomebrewery,
  toPlayerHandout,
  type ItemRarity,
  type MagicItemData,
} from "@uwe/database/magic-item";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { saveMagicItemAction } from "@/app/magic-item-actions";
import { Alert, Button, buttonVariants, Input, Label, Textarea } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; pageId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ExportBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-muted p-3 text-sm">
        {content}
      </pre>
    </section>
  );
}

export default async function MagicItemWorkbenchPage({ params, searchParams }: Props) {
  const { worldSlug, pageId } = await params;
  const { saved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const page = await prisma.page.findFirst({
    where: { id: pageId, worldId: world.id, type: "item" },
    select: { id: true, title: true, slug: true, type: true },
  });
  if (!page) notFound();

  // Zugewiesen wird an einen SPIELERCHARAKTER (Character-Datensatz) — das ist
  // der, dessen Spieler den Gegenstand am Tisch trägt. Die Wiki-Seiten unten
  // sind nur noch das Zusatzfeld für die Erzählung (NPC, Fraktion).
  const characters = await createCharacterService(prisma).listForWorld(world.id);

  const ownerPages = await prisma.page.findMany({
    where: { worldId: world.id, type: { in: ["npc", "faction"] } },
    select: { id: true, title: true, type: true, slug: true },
    orderBy: { title: "asc" },
  });

  const stored = await createMagicItemService(prisma).getForPage(pageId);
  const data: MagicItemData = stored?.data ?? {};
  const ownerCharacter = data.ownerCharacterId
    ? characters.find((entry) => entry.id === data.ownerCharacterId)
    : null;
  const ownerPage = data.ownerPageId
    ? ownerPages.find((entry) => entry.id === data.ownerPageId)
    : null;

  return (
    <>
      <ShellBreadcrumb
        items={[
          ...worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Magic-Item-Werkbank",
            `/worlds/${worldSlug}/magic-items`,
          ),
          { label: page.title },
        ]}
      />
      <PageHeader
        title={page.title}
        summary="Werkbank für diesen Gegenstand. DM-Felder (Fluch, Geheimnis) erscheinen nie im Spieler-Handout."
      />

      {saved ? <Alert tone="success" icon="circle-check" title="Gespeichert." /> : null}

      <form action={saveMagicItemAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="worldId" value={world.id} />
        <input type="hidden" name="pageId" value={pageId} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-type">Typ</Label>
          <Input
            id="item-type"
            name="itemType"
            defaultValue={data.itemType ?? ""}
            placeholder="z. B. Wundersamer Gegenstand"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-rarity">Seltenheit</Label>
          {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
              "—" (keine Seltenheit) — natives Select beibehalten. */}
          <select
            id="item-rarity"
            name="rarity"
            defaultValue={data.rarity ?? ""}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">—</option>
            {ITEM_RARITIES.map((rarity: ItemRarity) => (
              <option key={rarity} value={rarity}>
                {ITEM_RARITY_LABELS[rarity]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-owner-character">Besitzer (Spielercharakter)</Label>
          {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
              "kein Besitzer" — natives Select beibehalten. */}
          <select
            id="item-owner-character"
            name="ownerCharacterId"
            defaultValue={data.ownerCharacterId ?? ""}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">— kein Besitzer —</option>
            {characters.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
                {entry.owner ? ` (${entry.owner.displayName})` : ""}
              </option>
            ))}
          </select>
        </div>
        {ownerCharacter?.page ? (
          <p className="text-sm text-muted-foreground">
            Charakterbogen:{" "}
            <Link href={buildPageUrl(worldSlug, ownerCharacter.page.type, ownerCharacter.page.slug)}>
              {ownerCharacter.displayName}
            </Link>
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-owner">NPC / Fraktion mit Bezug (Zusatzfeld)</Label>
          {/* Erzähl-Bezug, keine Zuweisung: welcher NPC hütet den Gegenstand,
              welche Fraktion sucht ihn. */}
          <select
            id="item-owner"
            name="ownerPageId"
            defaultValue={data.ownerPageId ?? ""}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">— kein Bezug —</option>
            {ownerPages.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </div>
        {ownerPage ? (
          <p className="text-sm text-muted-foreground">
            Wiki-Seite:{" "}
            <Link href={buildPageUrl(worldSlug, ownerPage.type, ownerPage.slug)}>
              {ownerPage.title}
            </Link>
          </p>
        ) : null}

        {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresAttunement"
            defaultChecked={data.requiresAttunement ?? false}
            className="size-4 rounded border-input"
          />
          Erfordert Einstimmung
        </label>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-attunement-note">Einstimmungs-Zusatz</Label>
          <Input
            id="item-attunement-note"
            name="attunementNote"
            defaultValue={data.attunementNote ?? ""}
            placeholder="z. B. durch einen Zauberwirker"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-visible-description">Sichtbare Beschreibung (Spieler)</Label>
          <Textarea
            id="item-visible-description"
            name="visibleDescription"
            rows={4}
            defaultValue={data.visibleDescription ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-properties">Eigenschaften (eine pro Zeile)</Label>
          <Textarea
            id="item-properties"
            name="properties"
            rows={3}
            defaultValue={(data.properties ?? []).join("\n")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-dm-secret">DM-Geheimnis (nur GM)</Label>
          <Textarea id="item-dm-secret" name="dmSecret" rows={3} defaultValue={data.dmSecret ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-curse">Fluch / Nachteil (nur GM)</Label>
          <Textarea id="item-curse" name="curse" rows={2} defaultValue={data.curse ?? ""} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Speichern</Button>
          <Link href={`/worlds/${worldSlug}/magic-items`} className={buttonVariants({ variant: "outline" })}>
            Zurück
          </Link>
        </div>
      </form>

      <ExportBlock title="Homebrewery (DM, mit Geheimnis/Fluch)" content={toHomebrewery(page.title, data, true)} />
      <ExportBlock title="Spieler-Handout (player-safe)" content={toPlayerHandout(page.title, data)} />
      <ExportBlock title="5e.tools JSON" content={JSON.stringify(toFiveToolsJson(page.title, data), null, 2)} />
    </>
  );
}
