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
  createImageStudioService,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  prisma,
  resolveImageStudioConfig,
} from "@uwe/database/server";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { createImageStudioJobAction } from "../integration-actions";

export default async function ImageStudioPage() {
  const config = resolveImageStudioConfig();
  const imageStudio = createImageStudioService(prisma);
  const repo = getAppRepository();
  const [projects, worlds] = await Promise.all([
    imageStudio.listProjects(),
    repo.listWorldsWithGuestMode(),
  ]);

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("more")}
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Image Studio" href="/image-studio" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/image-studio")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Image Studio"
            summary="Bildgenerierung, Bearbeitung, Inpainting und Varianten — lokal via RTX oder optional Cloud-KI."
          />

          {!config.enabled && (
            <p className="uwe-notice uwe-notice-warn">
              Image Studio ist deaktiviert. Setze IMAGE_STUDIO_ENABLED=true in der Umgebung.
            </p>
          )}

          <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
            <h2>Neues Bild</h2>
            <form action={createImageStudioJobAction} className="uwe-form">
              <label>
                Welt
                <select name="worldSlug" required defaultValue={worlds[0]?.slug ?? ""}>
                  {worlds.map((w) => (
                    <option key={w.id} value={w.slug}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operation
                <select name="task" defaultValue="generate">
                  {Object.entries(IMAGE_STUDIO_OPERATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Provider
                <select name="providerMode" defaultValue={config.defaultProviderMode}>
                  <option value="auto">Auto (RTX → Cloud)</option>
                  <option value="local_rtx">Nur RTX (lokal)</option>
                  <option value="cloud" disabled={!config.allowCloud}>
                    Cloud {config.allowCloud ? "" : "(deaktiviert)"}
                  </option>
                </select>
              </label>
              <label>
                Titel (optional)
                <input name="title" type="text" placeholder="NPC-Portrait Gandalf" />
              </label>
              <label>
                Prompt
                <textarea name="prompt" required rows={4} placeholder="Episches DnD-Portrait …" />
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary" disabled={!config.enabled}>
                Generieren (Job)
              </button>
            </form>
            <p className="uwe-hint">
              Ergebnisse erscheinen als Asset in der Medienbibliothek. Fortschritt unter{" "}
              <Link href="/jobs">Jobs</Link>.
            </p>
          </section>

          <section>
            <h2 className="uwe-section-title">Projekte</h2>
            {projects.length === 0 ? (
              <EmptyState title="Noch keine Image-Studio-Projekte" description="Starte oben mit einem Prompt." />
            ) : (
              <ul className="uwe-list-cards">
                {projects.map((project) => (
                  <li key={project.id} className="uwe-list-card">
                    <strong>{project.title}</strong>
                    <span className="uwe-badge">{IMAGE_STUDIO_STATUS_LABELS[project.status]}</span>
                    {project.prompt && <p className="uwe-dashboard-muted">{project.prompt.slice(0, 120)}</p>}
                    {project.versions[0]?.assetId && (
                      <Link href={`/api/assets/${project.versions[0].assetId}/file`} target="_blank">
                        Vorschau
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      }
    />
  );
}
