import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createImportJobService,
  getAppRepository,
  IMPORT_JOB_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { ImportCentralWorkspace } from "../../../import/ImportCentralWorkspace";
import { toImportCentralJobRows } from "../../../import/import-job-summary";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Import-Zentrale im Welt-Cockpit.
 *
 * Global (`/import`) ließ sie die Zielwelt aus einer Liste wählen — in einer
 * Welt geöffnet ist die Wahl bereits getroffen, und der Verlauf zeigt nur noch
 * die Importe dieser Welt. Das Werkzeug selbst ist dasselbe
 * (`ImportCentralWorkspace`); eingegrenzt wird über die Welt-Liste, die es
 * bekommt.
 */
export default async function WorldImportCentralPage({ params }: Props) {
  const { worldSlug } = await params;
  await requireStudioAccess();

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const [campaigns, jobs] = await Promise.all([
    repo.listCampaignsByWorld(world.slug),
    createImportJobService(prisma).listJobs({ limit: 50, targetWorldId: world.id }),
  ]);

  const initialJobs = toImportCentralJobRows(
    jobs,
    new Map([[world.id, { name: world.name, slug: world.slug }]]),
  );

  const supportedFormats = importSourceRegistry.supportedFormats();
  const plannedFormats = importSourceRegistry.plannedFormats();

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Import-Zentrale",
          `/worlds/${worldSlug}/import-central`,
        )}
      />
      <ShellContextPanel>
        <SidebarSection title="Hinweise">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
            <li>
              Zielwelt ist <strong>{world.name}</strong> — der Verlauf zeigt nur deren Importe.
            </li>
            <li>
              Unterstützt: KnoteForge JSON → Welt; Markdown/Obsidian → Life Brain, Capture oder
              DnD-Seite; PDF zusätzlich → Kampagne. Obsidian auch als Vault-ZIP oder
              Ordner-Upload.
            </li>
            <li>
              Jeder Import wird als Job protokolliert — Status:{" "}
              {Object.values(IMPORT_JOB_STATUS_LABELS).join(", ")}.
            </li>
            <li>
              Formate: {supportedFormats.join(", ")}
              {plannedFormats.length > 0 ? ` · geplant: ${plannedFormats.join(", ")}` : ""}
            </li>
            <li>
              <Link href={`/worlds/${worldSlug}/jobs`}>Hintergrund-Jobs</Link> für asynchrone
              Import-Ausführung.
            </li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Import-Zentrale"
        summary={`Importe nach ${world.name} — Markdown, Obsidian, PDF und KnoteForge-JSON, mit Vorschau, Job-Verlauf und Rückgängig.`}
      />
      <ImportCentralWorkspace
        worlds={[
          {
            id: world.id,
            name: world.name,
            slug: world.slug,
            campaigns: campaigns.map(({ id, name, slug }) => ({ id, name, slug })),
          },
        ]}
        initialJobs={initialJobs}
        supportedFormats={supportedFormats}
        plannedFormats={plannedFormats}
      />
    </>
  );
}
