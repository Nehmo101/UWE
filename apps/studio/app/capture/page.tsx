import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { CaptureImageUpload } from "@/components/CaptureImageUpload";
import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";
import { CaptureInboxList } from "@/components/capture/CaptureInboxList";
import { AdminCreateCard, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";

interface Props {
  searchParams: Promise<{ quick?: string; status?: string; source?: string }>;
}

function parseSourceFilter(value: string | undefined): "manual" | "mail" | "scan" | undefined {
  if (value === "manual" || value === "mail" || value === "scan") return value;
  return undefined;
}

export default async function CapturePage({ searchParams }: Props) {
  const { quick, status, source } = await searchParams;
  const service = createLifeAdminService(prisma);
  const worlds = await getAppRepository().listWorldsWithGuestMode();
  const statusFilter =
    status === "archived" ? "archived" : status === "all" ? undefined : ("inbox" as const);
  const sourceFilter = parseSourceFilter(source);
  const captures = await service.listCaptures({
    status: statusFilter,
    sourceGroup: sourceFilter,
    limit: 100,
  });
  const showQuickForm = quick === "1" || quick === "true";

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Capture Inbox" }]} />}
      title="Capture Inbox"
      summary="Universeller mobiler Eingang — Notizen, Ideen, Links, Sprachmemos, Dateien und To-dos ohne RTX."
    >
      <AdminCreateCard title="Bild erfassen (Mobile)">
        <p className="uwe-hint">
          Fotos von Miniaturen, Terrain oder Handouts — optional direkt als Asset in einer Welt.
        </p>
        <CaptureImageUpload worlds={worlds.map((world) => ({ slug: world.slug, name: world.name }))} />
      </AdminCreateCard>

      <AdminCreateCard
        title={showQuickForm ? "Schnell erfassen" : "Neuer Capture"}
        className="uwe-capture-quick-section"
      >
        <QuickCaptureForm returnTo="/capture" autoFocus={showQuickForm} compact={showQuickForm} />
      </AdminCreateCard>

      <section className="uwe-v2-section">
        <div className="uwe-capture-inbox-head">
          <h2 className="uwe-v2-section-title">Inbox ({captures.length})</h2>
          <div className="uwe-capture-filter-tabs">
            <Link href="/capture" data-active={!status || status === "inbox" ? "true" : "false"}>
              Inbox
            </Link>
            <Link href="/capture?status=archived" data-active={status === "archived" ? "true" : "false"}>
              Archiv
            </Link>
            <Link href="/capture?status=all" data-active={status === "all" ? "true" : "false"}>
              Alle
            </Link>
          </div>
        </div>

        {captures.length === 0 ? (
          <EmptyState
            title="Inbox leer"
            description="Erfasse eine Notiz, Idee oder ein To-do — mit optionalem KI-Vorschlag zur Sortierung."
            action={<Link href="/capture?quick=1">Schnell erfassen</Link>}
          />
        ) : (
          <CaptureInboxList
            captures={captures.map((capture) => ({
              id: capture.id,
              title: capture.title,
              content: capture.content,
              captureType: capture.captureType,
              status: capture.status,
              capturedAt: capture.capturedAt.toISOString(),
              storageKey: capture.storageKey,
              metadata: capture.metadata,
            }))}
            statusFilter={status}
            sourceFilter={sourceFilter}
          />
        )}
      </section>
    </AdminModulePage>
  );
}
