import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  normalizeLabel,
  summarizePrintList,
} from "@uwe/database/server";
import { worldSidebar } from "../../page";
import {
  deletePrintListAction,
  setPrintListStatusAction,
  updatePrintListAction,
} from "@/app/label-actions";

interface Props {
  params: Promise<{ worldSlug: string; printListId: string }>;
  searchParams: Promise<{ saved?: string; created?: string; added?: string; status?: string }>;
}

export default async function PrintListDetailPage({ params, searchParams }: Props) {
  const { worldSlug, printListId } = await params;
  const { saved, created, added, status } = await searchParams;

  const repo = getAppRepository();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const list = await printListService.getById(printListId);
  if (!list || list.worldId !== world.id) notFound();

  const summary = summarizePrintList(list);
  const copiesJson = JSON.stringify(
    Object.fromEntries(list.items.map((item) => [item.labelId, item.copies])),
  );
  const labelOrder = list.items.map((item) => item.labelId).join(",");

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={worldSidebar(worldSlug, "labels")}
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Labels", href: `/worlds/${worldSlug}/labels?tab=print-lists` },
              { label: list.name },
            ]}
          />
          <PageHeader
            title={list.name}
            summary={`${summary.labelCount} Labels · ${summary.totalCopies} Kopien · Status: ${LABEL_PRINT_STATUS_LABELS[list.status]}`}
            actions={
              <>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=print`}
                  className="uwe-btn uwe-btn-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Druckliste drucken
                </a>
                <a
                  href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=pdf`}
                  className="uwe-btn"
                >
                  PDF exportieren
                </a>
              </>
            }
          />

          {(saved || created || added || status) && (
            <p className="uwe-flash uwe-flash-success">
              {created
                ? "Druckliste erstellt."
                : added
                  ? "Label hinzugefügt."
                  : status
                    ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS]}`
                    : "Gespeichert."}
            </p>
          )}

          {summary.hasDmOnly && (
            <p className="uwe-flash uwe-flash-warning">
              Diese Druckliste enthält Labels mit DM-only Inhalten.
            </p>
          )}

          <section className="uwe-panel">
            <h2>Druckliste bearbeiten</h2>
            <form action={updatePrintListAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="printListId" value={printListId} />
              <input type="hidden" name="labelOrder" value={labelOrder} />
              <input type="hidden" name="copiesJson" value={copiesJson} />

              <label>
                Name
                <input type="text" name="name" defaultValue={list.name} required />
              </label>
              <label>
                Beschreibung
                <textarea name="description" rows={2} defaultValue={list.description ?? ""} />
              </label>
              <label className="uwe-checkbox">
                <input type="checkbox" name="forNextSession" defaultChecked={list.forNextSession} />
                Für nächste Session vorbereitet
              </label>

              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Label</th>
                    <th>Kopien</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((item, index) => {
                    const parsed = normalizeLabel(item.label);
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          <Link href={`/worlds/${worldSlug}/labels/${item.labelId}`}>
                            {item.label.title}
                          </Link>
                          {parsed.content.containsDmOnly && (
                            <p className="uwe-table-sub uwe-text-warning">DM-only</p>
                          )}
                        </td>
                        <td>{item.copies}</td>
                        <td>
                          <Link href={`/worlds/${worldSlug}/labels/${item.labelId}/preview`}>
                            Vorschau
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="uwe-form-actions">
                <button type="submit" className="uwe-btn uwe-btn-primary">Speichern</button>
              </div>
            </form>
          </section>

          <div className="uwe-form-actions">
            <form action={setPrintListStatusAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="printListId" value={printListId} />
              <input type="hidden" name="status" value="printed" />
              <button type="submit" className="uwe-btn">Als gedruckt markieren</button>
            </form>
            <form action={deletePrintListAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="printListId" value={printListId} />
              <button type="submit" className="uwe-btn uwe-btn-danger">Löschen</button>
            </form>
            <Link href={`/worlds/${worldSlug}/labels?tab=print-lists`} className="uwe-btn">
              ← Zurück
            </Link>
          </div>
        </>
      }
      context={
        <SidebarSection title="Export">
          <ul className="uwe-sidebar-links">
            <li>
              <a href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=html`}>
                HTML exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/print-lists/${printListId}/export?format=pdf`}>
                PDF exportieren
              </a>
            </li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
