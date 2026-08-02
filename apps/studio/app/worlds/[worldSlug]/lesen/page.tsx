import Link from "next/link";
import { notFound } from "next/navigation";

import { getAppRepository } from "@uwe/database/server";

import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { Card, CardContent, EmptyState } from "@/src/components/ui";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { listVolumes } from "@/src/lib/volume-reader";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Die Bände einer Welt.
 *
 * Ein Band ist eine Seite mit Unterseiten, die selbst unter keiner hängt — nach
 * einem Dokument-Import genau das importierte Buch. Hier steht, was sich am
 * Stück lesen lässt; das Nachschlagen bleibt im Wiki.
 */
export default async function StudioVolumesPage({ params }: Props) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const volumes = await listVolumes(worldSlug);

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Lesen", `/worlds/${worldSlug}/lesen`)} />
      <PageHeader
        title="Lesen"
        summary="Kampagnen, Dungeons und Bände am Stück — in der Reihenfolge, in der sie geschrieben wurden."
      />

      {volumes.length === 0 ? (
        <EmptyState
          title="Noch nichts zu lesen"
          description="Bände entstehen beim Dokument-Import oder sobald eine Seite Unterseiten bekommt."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
          {volumes.map((volume) => (
            <Card key={volume.id}>
              <CardContent className="pt-6">
                <Link
                  href={`/worlds/${worldSlug}/lesen/${volume.slug}`}
                  className="text-base font-semibold"
                >
                  {volume.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {volume.pageCount} Abschnitte
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
