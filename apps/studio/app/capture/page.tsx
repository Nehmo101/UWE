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
  type CaptureStatus,
  type CaptureType,
} from "@uwe/database/server";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import {
  convertCaptureToProjectAction,
  convertCaptureToWorkshopAction,
  createCaptureAction,
  deleteCaptureAction,
  updateCaptureStatusAction,
} from "../capture-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_FILTERS: Array<{ value: CaptureStatus | "all"; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "inbox", label: "Inbox" },
  { value: "triaged", label: "Sortiert" },
  { value: "linked", label: "Verknüpft" },
  { value: "archived", label: "Archiviert" },
];

interface Props {
  searchParams: Promise<{ quick?: string; status?: string }>;
}

function resolveStatusFilter(raw: string | undefined): CaptureStatus | "all" {
  if (!raw || raw === "all") return "all";
  if (raw in CAPTURE_STATUS_LABELS) return raw as CaptureStatus;
  return "inbox";
}

export default async function CapturePage({ searchParams }: Props) {
  const { quick, status: statusRaw } = await searchParams;
  const statusFilter = resolveStatusFilter(statusRaw);
  const service = createLifeAdminService(prisma);
  const [captures, statusCounts] = await Promise.all([
    service.listCaptures({
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 100,
    }),
    service.getCaptureStatusCounts(),
  ]);
  const showQuickForm = quick === "1";
  const totalCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

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
            summary="Schnell erfassen ohne RTX — Notizen, Ideen, Links, Bilder und To-dos mit Triage."
          />

          <section className="uwe-today-attention" aria-label="Triage-Filter">
            <div className="uwe-today-quick-chips">
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.value === "all" ? totalCount : statusCounts[filter.value as CaptureStatus];
                const active = statusFilter === filter.value;
                return (
                  <Link
                    key={filter.value}
                    href={filter.value === "all" ? "/capture" : `/capture?status=${filter.value}`}
                    className="uwe-today-quick-chip"
                    data-severity={active ? "warn" : "info"}
                    aria-current={active ? "page" : undefined}
                  >
                    {filter.label} ({count})
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">
              {showQuickForm ? "Schnell erfassen" : "Neuer Capture"}
            </h2>
            <form
              action={createCaptureAction}
              className="uwe-brain-create-form"
              encType="multipart/form-data"
            >
              <input type="hidden" name="returnTo" value="/capture" />
              <label>
                Typ
                <select name="captureType" defaultValue="quick_note">
                  {(Object.keys(CAPTURE_TYPE_LABELS) as CaptureType[]).map((type) => (
                    <option key={type} value={type}>
                      {CAPTURE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titel (optional)
                <input name="title" type="text" placeholder="Kurzer Titel" />
              </label>
              <label>
                Inhalt
                <textarea
                  name="content"
                  rows={showQuickForm ? 3 : 5}
                  placeholder="Was möchtest du festhalten? (optional bei Bild-Upload)"
                  autoFocus={showQuickForm}
                />
              </label>
              <label>
                Link (optional)
                <input name="url" type="url" placeholder="https://…" />
              </label>
              <label>
                Bild/Datei (optional — setzt Typ auf Datei/Bild)
                <input name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" />
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Erfassen
              </button>
            </form>
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">
              {statusFilter === "all"
                ? `Alle Captures (${captures.length})`
                : `${CAPTURE_STATUS_LABELS[statusFilter]} (${captures.length})`}
            </h2>
            {captures.length === 0 ? (
              <EmptyState
                title={statusFilter === "inbox" ? "Inbox leer" : "Keine Einträge"}
                description="Erfasse eine Notiz, Idee, Link oder ein Bild — ohne KI, ohne RTX."
                action={<Link href="/capture?quick=1">Schnell erfassen</Link>}
              />
            ) : (
              <div className="uwe-today-card-list">
                {captures.map((capture) => (
                  <article key={capture.id} className="uwe-today-card">
                    <h3>{capture.title}</h3>
                    <p>
                      {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                      {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
                      {DATE_FORMAT.format(capture.capturedAt)}
                    </p>
                    {capture.content && <p>{capture.content}</p>}
                    {capture.url && (
                      <p>
                        <a href={capture.url} target="_blank" rel="noreferrer">
                          {capture.url}
                        </a>
                      </p>
                    )}
                    {capture.storageKey && (
                      <p className="uwe-capture-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/capture/${capture.id}/file`}
                          alt={capture.title || "Capture Bild"}
                          loading="lazy"
                        />
                      </p>
                    )}
                    <div className="uwe-inline-actions">
                      {capture.status === "inbox" && (
                        <form action={updateCaptureStatusAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <input type="hidden" name="status" value="triaged" />
                          <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                            Sortiert
                          </button>
                        </form>
                      )}
                      {(capture.status === "inbox" || capture.status === "triaged") && (
                        <>
                          <form action={convertCaptureToProjectAction}>
                            <input type="hidden" name="id" value={capture.id} />
                            <button
                              type="submit"
                              className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                            >
                              → Projekt
                            </button>
                          </form>
                          <form action={convertCaptureToWorkshopAction}>
                            <input type="hidden" name="id" value={capture.id} />
                            <button
                              type="submit"
                              className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                            >
                              → Werkstatt
                            </button>
                          </form>
                        </>
                      )}
                      {capture.status !== "archived" && (
                        <form action={updateCaptureStatusAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <input type="hidden" name="status" value="archived" />
                          <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                            Archivieren
                          </button>
                        </form>
                      )}
                      {capture.captureType === "file_image" && capture.storageKey && (
                        <Link
                          href="/image-studio"
                          className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                        >
                          Image Studio
                        </Link>
                      )}
                      <form action={deleteCaptureAction}>
                        <input type="hidden" name="id" value={capture.id} />
                        <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                          Löschen
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
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
