import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  CAPTURE_STATUS_LABELS,
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { CaptureImageUpload } from "@/components/CaptureImageUpload";
import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";
import { AdminCreateCard, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";
import { formatStudioDateTime } from "@/src/lib/format";
import { deleteCaptureAction } from "../capture-actions";

interface Props {
  searchParams: Promise<{ quick?: string; status?: string }>;
}

function readIntent(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const intent = (metadata as Record<string, unknown>).captureIntent;
  return typeof intent === "string" ? intent : null;
}

export default async function CapturePage({ searchParams }: Props) {
  const { quick, status } = await searchParams;
  const service = createLifeAdminService(prisma);
  const worlds = await getAppRepository().listWorldsWithGuestMode();
  const statusFilter =
    status === "archived"
      ? "archived"
      : status === "all"
        ? undefined
        : ("inbox" as const);
  const captures = await service.listCaptures({ status: statusFilter, limit: 100 });
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
            <QuickCaptureForm
              returnTo="/capture"
              autoFocus={showQuickForm}
              compact={showQuickForm}
            />
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
              <div className="uwe-today-card-list">
                {captures.map((capture) => {
                  const intent = readIntent(capture.metadata);
                  const typeLabel =
                    intent === "life_brain"
                      ? "Life-Brain-Fakt"
                      : CAPTURE_TYPE_LABELS[capture.captureType];

                  return (
                    <article key={capture.id} className="uwe-today-card uwe-v2-card uwe-v2-card-padded uwe-capture-inbox-card">
                      <Link href={`/capture/${capture.id}`} className="uwe-capture-inbox-link">
                        <h3>{capture.title}</h3>
                        <p>
                          {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
                          {formatStudioDateTime(capture.capturedAt)}
                        </p>
                        {capture.content ? <p className="uwe-capture-snippet">{capture.content}</p> : null}
                        {capture.storageKey ? <p className="uwe-capture-snippet">📎 Anhang</p> : null}
                      </Link>
                      <div className="uwe-inline-actions">
                        <Link href={`/capture/${capture.id}`} className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                          Triage
                        </Link>
                        <form action={deleteCaptureAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                            Löschen
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
    </AdminModulePage>
  );
}
