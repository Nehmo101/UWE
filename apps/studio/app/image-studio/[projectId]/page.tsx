import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createImageStudioService,
  extractImageStudioErrorMessage,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { ImageStudioProjectReview } from "@/components/ImageStudioProjectReview";
import { ImageStudioBulkDownload } from "@/components/ImageStudioBulkDownload";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";
import { ImageStudioJobForm } from "@/components/ImageStudioJobForm";
import { ImageStudioRetryButton } from "@/components/ImageStudioRetryButton";
import { createImageStudioJobAction } from "@/app/integration-actions";
import {
  Alert,
  badgeVariants,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ versionStatus?: string }>;
}

function chipLinkClass(active: boolean): string {
  return cn(
    badgeVariants({ variant: active ? "accent" : "default" }),
    "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
}

export default async function ImageStudioProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { versionStatus } = await searchParams;
  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project) notFound();

  const world = project.worldId
    ? await prisma.world.findUnique({ where: { id: project.worldId }, select: { slug: true, name: true } })
    : null;
  const errorMessage = extractImageStudioErrorMessage(project.metadata);
  const repo = getAppRepository();
  const settings = await repo.getSystemSettings();
  const config = settings.imageStudio;
  const worlds = await repo.listWorldsWithGuestMode();
  const latestWithAsset = project.versions.find((version) => version.assetId);
  const sourceAssetUrl = latestWithAsset?.assetId
    ? `/api/assets/${latestWithAsset.assetId}/file`
    : null;

  const filteredVersions = project.versions.filter((version) => {
    if (!versionStatus || versionStatus === "all") return true;
    if (versionStatus === "with_asset") return Boolean(version.assetId);
    if (versionStatus === "without_asset") return !version.assetId;
    return true;
  });

  const versionTabs = [
    { value: "all", label: "Alle Versionen" },
    { value: "with_asset", label: "Mit Asset" },
    { value: "without_asset", label: "Ohne Asset" },
  ];

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Image Studio", href: "/image-studio" },
            { label: project.title },
          ]}
        />
      }
    >
      <PageHeader
        title={project.title}
        summary="Versionen prüfen, Entwurf speichern, Asset übernehmen oder im Canvas bearbeiten."
        actions={
          <>
            <ImageStudioBulkDownload
              projectId={project.id}
              versions={project.versions.map((version) => ({
                id: version.id,
                versionNumber: version.versionNumber,
                assetId: version.assetId,
              }))}
            />
            {world?.slug ? (
              <Link
                href={`/worlds/${world.slug}/assets`}
                className={buttonVariants({ variant: "secondary" })}
              >
                Medienbibliothek
              </Link>
            ) : null}
            <Link href="/image-studio" className={buttonVariants({ variant: "secondary" })}>
              ← Alle Projekte
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <ImageStudioStatusBadge
          status={project.status}
          label={IMAGE_STUDIO_STATUS_LABELS[project.status]}
        />

        {project.status === "failed" && errorMessage ? (
          <Alert tone="danger">
            <p>{errorMessage}</p>
            <ImageStudioRetryButton projectId={project.id} />
          </Alert>
        ) : null}

        {world?.slug && config.enabled ? (
          <Card>
            <CardHeader>
              <CardTitle>Weitere Operation</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageStudioJobForm
                action={createImageStudioJobAction}
                worlds={worlds.map((entry) => ({ slug: entry.slug, name: entry.name }))}
                operationLabels={IMAGE_STUDIO_OPERATION_LABELS}
                defaultWorldSlug={world.slug}
                enabled={config.enabled}
                projectId={project.id}
                defaultPrompt={project.prompt ?? ""}
                defaultTitle={project.title}
                sourceAssetUrl={sourceAssetUrl}
              />
            </CardContent>
          </Card>
        ) : null}

        <nav className="flex flex-wrap gap-2" aria-label="Versions-Filter">
          {versionTabs.map((tab) => {
            const active = (versionStatus ?? "all") === tab.value;
            return (
              <Link
                key={tab.value}
                href={
                  tab.value === "all"
                    ? `/image-studio/${projectId}`
                    : `/image-studio/${projectId}?versionStatus=${tab.value}`
                }
                aria-current={active ? "page" : undefined}
                className={chipLinkClass(active)}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <ImageStudioProjectReview
          projectId={project.id}
          title={project.title}
          prompt={project.prompt}
          status={project.status}
          statusLabel={IMAGE_STUDIO_STATUS_LABELS[project.status]}
          worldSlug={world?.slug ?? null}
          versions={filteredVersions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            operation: version.operation,
            prompt: version.prompt,
            assetId: version.assetId,
            providerMode: version.providerMode,
          }))}
          links={project.links.map((link) => ({
            targetType: link.targetType,
            targetId: link.targetId,
          }))}
        />
      </div>
    </StudioShell>
  );
}
