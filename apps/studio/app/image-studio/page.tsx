import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createImageStudioService,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  ImageStudioStatusEnum,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { ImageStudioJobForm } from "@/components/ImageStudioJobForm";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";
import { ImageStudioWorkspace } from "@/components/ImageStudioWorkspace";
import { createImageStudioJobAction } from "../integration-actions";
import { Alert, badgeVariants, buttonVariants, cn, EmptyState } from "@/src/components/ui";
import { commandCenterHint } from "@/src/lib/command-center-hint";

interface Props {
  searchParams: Promise<{ pageId?: string; project?: string; status?: string }>;
}

function chipLinkClass(active: boolean): string {
  return cn(
    badgeVariants({ variant: active ? "accent" : "default" }),
    "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
}

export default async function ImageStudioPage({ searchParams }: Props) {
  const { pageId, project, status: statusRaw } = await searchParams;
  if (project?.trim()) {
    redirect(`/image-studio/${project.trim()}`);
  }
  const repo = getAppRepository();
  const settings = await repo.getSystemSettings();
  const config = settings.imageStudio;
  const statusFilter =
    statusRaw && Object.values(ImageStudioStatusEnum).includes(statusRaw as (typeof ImageStudioStatusEnum)[keyof typeof ImageStudioStatusEnum])
      ? (statusRaw as (typeof ImageStudioStatusEnum)[keyof typeof ImageStudioStatusEnum])
      : undefined;

  const imageStudio = createImageStudioService(prisma);
  const [projects, worlds] = await Promise.all([
    imageStudio.listProjects(undefined, { status: statusFilter }),
    repo.listWorldsWithGuestMode(),
  ]);

  const jobForm = (
    <ImageStudioJobForm
      action={createImageStudioJobAction}
      worlds={worlds.map((world) => ({ slug: world.slug, name: world.name }))}
      operationLabels={IMAGE_STUDIO_OPERATION_LABELS}
      defaultWorldSlug={worlds[0]?.slug}
      enabled={config.enabled}
      pageId={pageId}
      linkTargetType="page"
    />
  );

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Image Studio" }]} />}>
      <PageHeader
        title="Image Studio"
        summary="Prompt-Generierung und Inpainting (RTX) — optional Cloud nur für generate/variant."
      />

      <div className="flex flex-col gap-6">
        {!config.enabled && (
          <Alert tone="warning">
            Image Studio ist deaktiviert. {commandCenterHint("Image Studio")}
          </Alert>
        )}

        {pageId && (
          <Alert tone="info">
            Verknüpft mit Seite <code>{pageId}</code> — Ergebnis wird automatisch verlinkt.
          </Alert>
        )}

        <ImageStudioWorkspace inlineForm={jobForm} disabled={!config.enabled} />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Projekte</h2>
          <nav className="flex flex-wrap gap-2" aria-label="Status-Filter">
            <Link
              href="/image-studio"
              aria-current={!statusFilter ? "page" : undefined}
              className={chipLinkClass(!statusFilter)}
            >
              Alle
            </Link>
            {Object.values(ImageStudioStatusEnum).map((status) => (
              <Link
                key={status}
                href={`/image-studio?status=${status}`}
                aria-current={statusFilter === status ? "page" : undefined}
                className={chipLinkClass(statusFilter === status)}
              >
                {IMAGE_STUDIO_STATUS_LABELS[status]}
              </Link>
            ))}
          </nav>
          {projects.length === 0 ? (
            <EmptyState
              title="Noch keine Image-Studio-Projekte"
              description="Starte oben mit einem Prompt."
            />
          ) : (
            <ul className="grid gap-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{project.title}</strong>
                    <ImageStudioStatusBadge
                      status={project.status}
                      label={IMAGE_STUDIO_STATUS_LABELS[project.status]}
                    />
                  </div>
                  {project.prompt && (
                    <p className="text-sm text-muted-foreground">{project.prompt.slice(0, 120)}</p>
                  )}
                  {project.versions[0]?.assetId && (
                    <Link
                      href={`/api/assets/${project.versions[0].assetId}/file`}
                      target="_blank"
                      className={buttonVariants({ variant: "link", size: "sm" })}
                    >
                      Vorschau
                    </Link>
                  )}
                  <Link
                    href={`/image-studio/${project.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Projekt öffnen
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
