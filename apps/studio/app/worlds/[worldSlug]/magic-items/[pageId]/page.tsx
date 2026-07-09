import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildPageUrl,
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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { saveMagicItemAction } from "@/app/magic-item-actions";

interface Props {
  params: Promise<{ worldSlug: string; pageId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

function ExportBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="uwe-v2-section">
      <h2 className="uwe-v2-section-title">{title}</h2>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: "0.75rem",
          borderRadius: "6px",
          background: "var(--uwe-code-bg, rgba(0,0,0,0.05))",
          overflowX: "auto",
        }}
      >
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

  const ownerPages = await prisma.page.findMany({
    where: { worldId: world.id, type: { in: ["player_character", "npc", "faction"] } },
    select: { id: true, title: true, type: true, slug: true },
    orderBy: { title: "asc" },
  });

  const stored = await createMagicItemService(prisma).getForPage(pageId);
  const data: MagicItemData = stored?.data ?? {};
  const ownerPage = data.ownerPageId
    ? ownerPages.find((entry) => entry.id === data.ownerPageId)
    : null;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
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
      }
    >
      <PageHeader
        title={page.title}
        summary="Werkbank für diesen Gegenstand. DM-Felder (Fluch, Geheimnis) erscheinen nie im Spieler-Handout."
      />

      {saved ? (
        <p className="uwe-inspector-ok" role="status">
          ✓ Gespeichert.
        </p>
      ) : null}

      <form action={saveMagicItemAction} className="uwe-v2-section" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="worldId" value={world.id} />
        <input type="hidden" name="pageId" value={pageId} />

        <label>
          Typ
          <input type="text" name="itemType" defaultValue={data.itemType ?? ""} placeholder="z. B. Wundersamer Gegenstand" />
        </label>
        <label>
          Seltenheit
          <select name="rarity" defaultValue={data.rarity ?? ""}>
            <option value="">—</option>
            {ITEM_RARITIES.map((rarity: ItemRarity) => (
              <option key={rarity} value={rarity}>
                {ITEM_RARITY_LABELS[rarity]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Besitzer (Wiki-Seite)
          <select name="ownerPageId" defaultValue={data.ownerPageId ?? ""}>
            <option value="">— kein Besitzer —</option>
            {ownerPages.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        {ownerPage ? (
          <p className="uwe-hint" style={{ margin: 0 }}>
            Wiki-Seite des Besitzers:{" "}
            <Link href={buildPageUrl(worldSlug, ownerPage.type, ownerPage.slug)}>
              {ownerPage.title}
            </Link>
          </p>
        ) : null}
        <label>
          <input type="checkbox" name="requiresAttunement" defaultChecked={data.requiresAttunement ?? false} /> Erfordert Einstimmung
        </label>
        <label>
          Einstimmungs-Zusatz
          <input type="text" name="attunementNote" defaultValue={data.attunementNote ?? ""} placeholder="z. B. durch einen Zauberwirker" />
        </label>
        <label>
          Sichtbare Beschreibung (Spieler)
          <textarea name="visibleDescription" rows={4} defaultValue={data.visibleDescription ?? ""} />
        </label>
        <label>
          Eigenschaften (eine pro Zeile)
          <textarea name="properties" rows={3} defaultValue={(data.properties ?? []).join("\n")} />
        </label>
        <label>
          DM-Geheimnis (nur GM)
          <textarea name="dmSecret" rows={3} defaultValue={data.dmSecret ?? ""} />
        </label>
        <label>
          Fluch / Nachteil (nur GM)
          <textarea name="curse" rows={2} defaultValue={data.curse ?? ""} />
        </label>
        <div className="uwe-form-actions">
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Speichern
          </button>
          <Link href={`/worlds/${worldSlug}/magic-items`} className="uwe-v2-btn">
            Zurück
          </Link>
        </div>
      </form>

      <ExportBlock title="Homebrewery (DM, mit Geheimnis/Fluch)" content={toHomebrewery(page.title, data, true)} />
      <ExportBlock title="Spieler-Handout (player-safe)" content={toPlayerHandout(page.title, data)} />
      <ExportBlock title="5e.tools JSON" content={JSON.stringify(toFiveToolsJson(page.title, data), null, 2)} />
    </WorldShell>
  );
}
