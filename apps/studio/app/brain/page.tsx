import Link from "next/link";
import {
  AppShell,
  EmptyState,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Brain Knowledge Store" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/" },
              { label: "Brain Store", href: "/brain", active: true },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Brain Knowledge Store"
            summary="Dauerhaftes Welt- und Kampagnenwissen — gespeichert in UWE auf dem Host-Laptop, nicht auf dem RTX-Inferenz-Rechner."
          />

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
                  <Link href={`/worlds/${world.slug}/brain`} className="uwe-btn uwe-btn-secondary">
                    Brain Store öffnen
                  </Link>
                </p>
              </section>
            ))
          )}
        </>
      }
      context={
        <SidebarSection title="Sichtbarkeit">
          <ul style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, paddingLeft: "1.1rem" }}>
            {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
              <li key={value}>
                <strong>{label}</strong>
              </li>
            ))}
          </ul>
        </SidebarSection>
      }
    />
  );
}
