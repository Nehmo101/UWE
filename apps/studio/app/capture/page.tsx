import Link from "next/link";
import {
  AppShell,
  EmptyState,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  CAPTURE_STATUS_LABELS,
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  prisma,
} from "@uwe/database/server";
import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { deleteCaptureAction } from "../capture-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  const statusFilter =
    status === "archived"
      ? "archived"
      : status === "all"
        ? undefined
        : ("inbox" as const);
  const captures = await service.listCaptures({ status: statusFilter, limit: 100 });
  const showQuickForm = quick === "1" || quick === "true";

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("capture")}
      contextTitle="Capture"
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Capture Inbox" href="/today" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/capture")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Capture Inbox"
            summary="Universeller mobiler Eingang — Notizen, Ideen, Links, Dateien und To-dos ohne RTX."
          />

          <section className="uwe-card uwe-section uwe-capture-quick-section">
            <h2 className="uwe-section-title">
              {showQuickForm ? "Schnell erfassen" : "Neuer Capture"}
            </h2>
            <QuickCaptureForm
              returnTo="/capture"
              autoFocus={showQuickForm}
              compact={showQuickForm}
            />
          </section>

          <section className="uwe-section">
            <div className="uwe-capture-inbox-head">
              <h2 className="uwe-section-title">Inbox ({captures.length})</h2>
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
                    <article key={capture.id} className="uwe-today-card uwe-capture-inbox-card">
                      <Link href={`/capture/${capture.id}`} className="uwe-capture-inbox-link">
                        <h3>{capture.title}</h3>
                        <p>
                          {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
                          {DATE_FORMAT.format(capture.capturedAt)}
                        </p>
                        {capture.content ? <p className="uwe-capture-snippet">{capture.content}</p> : null}
                        {capture.storageKey ? <p className="uwe-capture-snippet">📎 Anhang</p> : null}
                      </Link>
                      <div className="uwe-inline-actions">
                        <Link href={`/capture/${capture.id}`} className="uwe-btn uwe-btn-primary uwe-btn-sm">
                          Triage
                        </Link>
                        <form action={deleteCaptureAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
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

          <p className="uwe-dashboard-muted">
            <Link href="/today">← Zurück zu Heute</Link>
          </p>
        </>
      }
    />
  );
}
