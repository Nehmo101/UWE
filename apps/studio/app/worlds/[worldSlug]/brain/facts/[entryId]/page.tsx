import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  BRAIN_FACT_TYPE_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { updateBrainFactAction } from "../../../../../brain-actions";

interface Props {
  params: Promise<{ worldSlug: string; entryId: string }>;
}

export default async function StudioBrainFactPage({ params }: Props) {
  const { worldSlug, entryId } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const fact = await brain.getFactByIdForWorld(worldSlug, entryId);
  if (!fact) notFound();

  const links = await brain.listLinksForSource(worldSlug, "brain_fact", entryId);
  await db.$disconnect();

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/studio" />}
      sidebar={
        <SidebarSection title="Brain">
          <SidebarNav
            items={[
              { label: "← Brain Store", href: `/worlds/${worldSlug}/brain` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Brain Store", href: `/worlds/${worldSlug}/brain` },
              { label: fact.title },
            ]}
          />
          <PageHeader title={fact.title} summary="Brain-Fakt bearbeiten" />

          <form action={updateBrainFactAction} className="uwe-brain-edit-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="factId" value={fact.id} />

            <label>
              Titel
              <input name="title" defaultValue={fact.title} required className="uwe-input" />
            </label>

            <label>
              Inhalt
              <textarea name="content" defaultValue={fact.content} className="uwe-input" rows={8} />
            </label>

            <label>
              Typ
              <select name="factType" defaultValue={fact.factType} className="uwe-input">
                {Object.entries(BRAIN_FACT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sichtbarkeit
              <select name="visibility" defaultValue={fact.visibility} className="uwe-input">
                {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select name="status" defaultValue={fact.status} className="uwe-input">
                {Object.entries(BRAIN_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <p className="uwe-brain-meta">
              Quelle: {BRAIN_SOURCE_LABELS[fact.source]}
              {fact.page && (
                <>
                  {" "}
                  · Seite: {fact.page.title}
                </>
              )}
            </p>

            <button type="submit" className="uwe-btn uwe-btn-primary">
              Speichern
            </button>
          </form>

          {links.length > 0 && (
            <section className="uwe-brain-section">
              <h2>Links</h2>
              <ul>
                {links.map((link) => (
                  <li key={link.id}>
                    {link.relationType}: {link.targetType} → {link.targetId}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      }
    />
  );
}
