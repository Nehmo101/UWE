import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { TagAdminWorkspace } from "@/components/TagAdminWorkspace";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

/**
 * Tag-Aufräumer einer Welt — lag früher unter `/admin/tags`.
 *
 * Tags verschlagworten Inhalte, sie konfigurieren nichts am System; damit
 * gehören sie ins Welt-Cockpit und nicht in den Admin-Bereich (Notiz Lasse,
 * D30). Die Welt kommt aus der Route, es gibt keinen Welt-Filter mehr.
 */

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function WorldTagsPage({ params }: Props) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Tags", `/worlds/${worldSlug}/tags`)} />
      <PageHeader
        title={`Tags — ${world.name}`}
        summary="Tags dieser Welt normalisieren, ähnliche Schreibweisen erkennen und über alle Entitäten zusammenführen."
      />
      <TagAdminWorkspace worldId={world.id} />
    </>
  );
}
