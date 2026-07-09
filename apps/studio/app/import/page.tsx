import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createImportJobService,
  getAppRepository,
  IMPORT_JOB_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { importSourceRegistry } from "@uwe/knoteforge-import";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  ImportCentralWorkspace,
  type ImportCentralJobRow,
} from "./ImportCentralWorkspace";

export default async function ImportCentralPage() {
  await requireStudioAccess();
  const [worlds, jobs] = await Promise.all([
    getAppRepository().listWorlds(),
    createImportJobService(prisma).listJobs({ limit: 50 }),
  ]);

  const worldById = new Map(worlds.map((world) => [world.id, world]));

  const initialJobs: ImportCentralJobRow[] = jobs.map((job) => {
    const world = job.targetWorldId ? worldById.get(job.targetWorldId) : undefined;
    const metadata =
      job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : null;
    const metadataSlug = typeof metadata?.worldSlug === "string" ? metadata.worldSlug : null;

    return {
      id: job.id,
      sourceType: job.sourceType,
      targetType: job.targetType,
      status: job.status,
      fileName: job.fileName,
      targetWorldId: job.targetWorldId,
      targetWorldName: world?.name ?? null,
      targetWorldSlug: world?.slug ?? metadataSlug,
      previewPayload: job.previewPayload,
      resultSummary: job.resultSummary,
      undoToken: job.undoToken,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  });

  const supportedFormats = importSourceRegistry.supportedFormats();
  const plannedFormats = importSourceRegistry.plannedFormats();

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Import-Zentrale" }]} />}
      contextPanel={
        <SidebarSection title="Hinweise">
          <ul className="uwe-import-context-list">
            <li>
              Unterstützt: KnoteForge JSON → Welt; Markdown/Obsidian/PDF → Life Brain, Capture oder
              DnD-Seite. Obsidian auch als Vault-ZIP oder Ordner-Upload.
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
              <Link href="/jobs">Hintergrund-Jobs</Link> für asynchrone Import-Ausführung.
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Import-Zentrale"
        summary="Zentraler Einstieg für Importe in Welten, Life Brain, Capture und DnD-Seiten — mit Job-Verlauf, Vorschau und Status."
      />
      <ImportCentralWorkspace
        worlds={worlds.map((world) => ({ id: world.id, name: world.name, slug: world.slug }))}
        initialJobs={initialJobs}
        supportedFormats={supportedFormats}
        plannedFormats={plannedFormats}
      />
    </StudioShell>
  );
}
