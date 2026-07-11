import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageUrl, createCharacterService, getAppRepository, prisma } from "@uwe/database/server";
import { CharacterPrintFormatPicker } from "@/src/components/characters/CharacterPrintFormatPicker";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldRead } from "@/src/lib/authz";
import { buttonVariants, EmptyState } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ characterId?: string }>;
}

export default async function CharacterPrintPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { characterId } = await searchParams;

  try {
    await requireStudioWorldRead(worldSlug);
  } catch {
    notFound();
  }

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const shellProps = {
    worldSlug,
    worldName: world.name,
    breadcrumb: (
      <BreadcrumbTrail
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Charakterbogen drucken",
          `/worlds/${worldSlug}/characters/print`,
        )}
      />
    ),
  };

  if (!characterId) {
    const characters = await createCharacterService(prisma).listForWorld(world.id);
    return (
      <WorldShell {...shellProps}>
        <PageHeader
          title="Charakterbogen drucken"
          summary="Wähle einen Charakter für Druckansicht oder Markdown-Export."
        />
        {characters.length === 0 ? (
          <EmptyState
            title="Noch keine Charaktere"
            description="Lege zuerst einen Charakter mit Charakterbogen an, dann kannst du ihn hier drucken."
          />
        ) : (
          <ul className="grid gap-2">
            {characters.map((character) => (
              <li
                key={character.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <strong>{character.displayName}</strong>
                  {character.owner && (
                    <span className="text-sm text-muted-foreground">{character.owner.displayName}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/worlds/${worldSlug}/characters/print?characterId=${character.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Bogen drucken
                  </Link>
                  {character.page && (
                    <Link href={buildPageUrl(worldSlug, character.page.type, character.page.slug)}>
                      Zur Seite
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </WorldShell>
    );
  }

  return (
    <WorldShell {...shellProps}>
      <CharacterPrintFormatPicker
        worldSlug={worldSlug}
        characterId={characterId}
        worldName={world.name}
      />
    </WorldShell>
  );
}
