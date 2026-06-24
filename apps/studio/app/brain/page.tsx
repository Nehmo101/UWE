import Link from "next/link";
import {
  EmptyState,
  SidebarSection,
  VisibilityBadge,
} from "@uwe/shared-ui";
import type { Visibility } from "@uwe/database/enums";
import {
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";

export default async function BrainOverviewPage() {
  const repo = getAppRepository();
  const worlds = await repo.listWorlds();

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const worldSummaries = await Promise.all(
    worlds.map(async (world) => {
      const [documents, facts, summary] = await Promise.all([
        brain.listDocuments(world.slug, { accessContext: "dm", includeArchived: true }),
        brain.listFacts(world.slug, { accessContext: "dm", includeArchived: true }),
        brain.getWorldSummary(world.slug),
      ]);
      return { world, documents, facts, summary };
    }),
  );

  await db.$disconnect();

  return (
    <AdminModuleShell
      activePath="/brain"
      title="Brain Knowledge Store"
      summary="Dauerhaftes DnD-Welt- und Kampagnenwissen — getrennt vom privaten Life-Brain unter /life-brain."
      context={
        <SidebarSection title="Sichtbarkeit">
          <ul className="uwe-hint" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
              <li key={value}>
                <strong>{label}</strong>
              </li>
            ))}
          </ul>
        </SidebarSection>
      }
    >
      {worlds.length === 0 ? (
        <EmptyState
          title="Keine Welten"
          description="Lege zuerst eine Welt an, um Brain-Einträge zu speichern."
        />
      ) : (
        worldSummaries.map(({ world, documents, facts, summary }) => (
          <section key={world.id} className="uwe-brain-section">
            <h2>
              <Link href={`/worlds/${world.slug}/brain`}>{world.name}</Link>
            </h2>
            {summary && (
              <p className="uwe-brain-summary">
                {summary.documentCount} Dokumente · {summary.factCount} Fakten ·{" "}
                {summary.chunkCount} Chunks
              </p>
            )}

            {(documents.length > 0 || facts.length > 0) && (
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Eintrag</th>
                    <th>Art</th>
                    <th>Sichtbarkeit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.slice(0, 5).map((doc) => (
                    <tr key={doc.id}>
                      <td data-label="Eintrag">
                        <Link href={`/worlds/${world.slug}/brain/${doc.id}`}>
                          {doc.title}
                        </Link>
                      </td>
                      <td data-label="Art">Dokument</td>
                      <td data-label="Sichtbarkeit">
                        <VisibilityBadge visibility={doc.visibility as Visibility} />
                      </td>
                      <td data-label="Status">{BRAIN_STATUS_LABELS[doc.status]}</td>
                    </tr>
                  ))}
                  {facts.slice(0, 5).map((fact) => (
                    <tr key={fact.id}>
                      <td data-label="Eintrag">
                        <Link href={`/worlds/${world.slug}/brain/facts/${fact.id}`}>
                          {fact.title}
                        </Link>
                      </td>
                      <td data-label="Art">Fakt</td>
                      <td data-label="Sichtbarkeit">
                        <VisibilityBadge visibility={fact.visibility as Visibility} />
                      </td>
                      <td data-label="Status">{BRAIN_STATUS_LABELS[fact.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="uwe-brain-meta">
              <Link href={`/worlds/${world.slug}/brain`} className="uwe-v2-btn uwe-v2-btn-secondary">
                Brain Store öffnen
              </Link>
              <span className="uwe-hint" style={{ marginLeft: "0.75rem" }}>
                KI-Wissensgenerierung pro Welt im{" "}
                <Link href={`/worlds/${world.slug}/brain`}>Brain Store</Link>.
              </span>
            </p>
          </section>
        ))
      )}
    </AdminModuleShell>
  );
}
