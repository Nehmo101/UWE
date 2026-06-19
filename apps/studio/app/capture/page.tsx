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
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
  type CaptureType,
} from "@uwe/database/server";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import {
  createCaptureAction,
  deleteCaptureAction,
  updateCaptureStatusAction,
} from "../capture-actions";
import { promoteCaptureToLifeBrainAction } from "../life-admin-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  searchParams: Promise<{ quick?: string }>;
}

export default async function CapturePage({ searchParams }: Props) {
  const { quick } = await searchParams;
  const captures = await createLifeAdminService(prisma).listCaptures({ limit: 100 });
  const showQuickForm = quick === "1";

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
            summary="Schnell erfassen ohne RTX — Notizen, Ideen, Links und To-dos landen hier."
          />

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">
              {showQuickForm ? "Schnell erfassen" : "Neuer Capture"}
            </h2>
            <form action={createCaptureAction} className="uwe-brain-create-form">
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
                  required
                  placeholder="Was möchtest du festhalten?"
                  autoFocus={showQuickForm}
                />
              </label>
              <label>
                Link (optional)
                <input name="url" type="url" placeholder="https://…" />
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Erfassen
              </button>
            </form>
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Inbox ({captures.length})</h2>
            {captures.length === 0 ? (
              <EmptyState
                title="Inbox leer"
                description="Erfasse eine Notiz, Idee oder ein To-do — ohne KI, ohne RTX."
                action={<Link href="/today">Heute öffnen</Link>}
              />
            ) : (
              <div className="uwe-today-card-list">
                {captures.map((capture) => (
                  <article key={capture.id} className="uwe-today-card">
                    <h3>{capture.title}</h3>
                    <p>
                      {CAPTURE_TYPE_LABELS[capture.captureType]} · {capture.status} ·{" "}
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
                    <div className="uwe-inline-actions">
                      {capture.status !== "linked" && (
                        <form action={promoteCaptureToLifeBrainAction} className="uwe-inline-form">
                          <input type="hidden" name="captureId" value={capture.id} />
                          <label className="uwe-sr-only" htmlFor={`category-${capture.id}`}>
                            Life-Brain-Kategorie
                          </label>
                          <select
                            id={`category-${capture.id}`}
                            name="category"
                            defaultValue="personal_notes"
                            aria-label="Life-Brain-Kategorie"
                          >
                            {PERSONAL_BRAIN_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {PERSONAL_BRAIN_CATEGORY_LABELS[category]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="uwe-btn uwe-btn-primary uwe-btn-sm">
                            Ins Life Brain
                          </button>
                        </form>
                      )}
                      {capture.status === "inbox" && (
                        <form action={updateCaptureStatusAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <input type="hidden" name="status" value="triaged" />
                          <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                            Sortiert
                          </button>
                        </form>
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
