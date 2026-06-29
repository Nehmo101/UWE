import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
} from "@uwe/shared-ui";
import {
  createDndApiService,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
} from "@uwe/database/server";
import { searchAllDndApis } from "@uwe/dnd-api";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DndApiEncounterPanel } from "@/components/DndApiEncounterPanel";
import { addDndBeyondReferenceAction } from "../../../integration-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function WorldDndApiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const config = resolveDndApiConfig();
  const dndApi = createDndApiService(prisma);
  const beyondReferences = await dndApi.listBeyondReferences(world.id);

  let results: Awaited<ReturnType<typeof searchAllDndApis>> = [];
  if (q?.trim()) {
    results = await searchAllDndApis(q, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });
  }

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "DnD API", `/worlds/${worldSlug}/dnd-api`)}
        />
      }
    >
      <PageHeader
        title="DnD API"
        summary="Open5e + D&amp;D 5e SRD API. D&amp;D Beyond nur als manuelle Link-Referenz — kein Scraping."
      />
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-form" style={{ marginBottom: "1rem" }}>
        <h2>Suche (Open5e / SRD)</h2>
        <form method="get" className="uwe-v2-form uwe-form-inline">
          <input name="q" defaultValue={q ?? ""} placeholder="Goblin, Fireball …" />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Suchen
          </button>
        </form>
      </section>

      {q && (
        <>
          <DndApiEncounterPanel
            worldSlug={worldSlug}
            results={results.map((item) => ({
              provider: item.provider,
              id: item.id,
              name: item.name,
              url: item.url,
              summary: item.summary,
            }))}
          />
          <section style={{ marginBottom: "1.5rem" }}>
            <h2 className="uwe-v2-section-title">{`Alle Ergebnisse für „${q}“`}</h2>
            {results.length === 0 ? (
              <EmptyState title="Keine Treffer" description="Andere Schreibweise oder API deaktiviert?" />
            ) : (
              <ul className="uwe-list-cards">
                {results.map((item) => (
                  <li key={`${item.provider}-${item.id}`} className="uwe-list-card">
                    <strong>{item.name}</strong>
                    <span className="uwe-badge">{item.provider}</span>
                    {item.summary && <p className="uwe-dashboard-muted">{item.summary}</p>}
                    <a href={item.url} target="_blank" rel="noreferrer">
                      API / Quelle
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-form" style={{ marginBottom: "1.5rem" }}>
        <h2>D&amp;D Beyond Referenz (manuell)</h2>
        <form action={addDndBeyondReferenceAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <label>
            Titel
            <input name="title" required />
          </label>
          <label>
            D&amp;D Beyond URL
            <input name="url" type="url" required placeholder="https://www.dndbeyond.com/…" />
          </label>
          <label>
            Typ (optional)
            <input name="entityType" placeholder="monster, spell, …" />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Referenz speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="uwe-v2-section-title">Gespeicherte D&amp;D Beyond Links</h2>
        {beyondReferences.length === 0 ? (
          <EmptyState title="Keine Referenzen" description="Füge manuelle D&D Beyond Links hinzu." />
        ) : (
          <ul className="uwe-list-cards">
            {beyondReferences.map((ref) => (
              <li key={ref.id} className="uwe-list-card">
                <strong>{ref.title}</strong>
                {ref.entityType && <span className="uwe-badge">{ref.entityType}</span>}
                <a href={ref.url} target="_blank" rel="noreferrer">
                  D&amp;D Beyond öffnen
                </a>
                {ref.page && (
                  <Link href={`/worlds/${worldSlug}/${ref.page.slug}`}>
                    UWE-Seite: {ref.page.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
