import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BRAIN_FACT_TYPE_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
  buildPageUrl,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { updateBrainFactAction } from "../../../../../brain-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; entryId: string }>;
}

function factDetailHref(worldSlug: string, factId: string) {
  return `/worlds/${worldSlug}/brain/facts/${factId}`;
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

  const [links, allFacts] = await Promise.all([
    brain.listLinksForSource(worldSlug, "brain_fact", entryId),
    brain.listFacts(worldSlug, { factType: fact.factType }),
  ]);
  await db.$disconnect();

  const similarFacts = allFacts
    .filter((candidate) => candidate.id !== fact.id)
    .slice(0, 6);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Brain Store",
            `/worlds/${worldSlug}/brain`,
            fact.title,
          )}
        />
      }
    >
      <PageHeader
        title={fact.title}
        summary="Brain-Fakt bearbeiten"
      />

      <section className="uwe-brain-section">
        <h2>Quellen &amp; Bezüge</h2>
        <ul className="uwe-linked-list">
          <li>
            Quelle: <strong>{BRAIN_SOURCE_LABELS[fact.source]}</strong>
          </li>
          {fact.page && (
            <li>
              Wiki-Seite:{" "}
              <Link href={buildPageUrl(worldSlug, fact.page.type, fact.page.slug)}>
                {fact.page.title}
              </Link>
            </li>
          )}
          {fact.campaign && (
            <li>
              Kampagne:{" "}
              <Link href={`/worlds/${worldSlug}?campaign=${fact.campaign.slug}`}>
                {fact.campaign.name}
              </Link>
            </li>
          )}
          {fact.gameSession && (
            <li>
              Session:{" "}
              <Link href={`/worlds/${worldSlug}/sessions/${fact.gameSession.id}`}>
                {fact.gameSession.title}
                {fact.gameSession.sessionNumber != null
                  ? ` (#${fact.gameSession.sessionNumber})`
                  : ""}
              </Link>
            </li>
          )}
        </ul>
      </section>

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

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Speichern
        </button>
      </form>

      {similarFacts.length > 0 && (
        <section className="uwe-brain-section">
          <h2>Ähnliche Fakten</h2>
          <p className="uwe-hint">
            Weitere Fakten vom Typ „{BRAIN_FACT_TYPE_LABELS[fact.factType]}“.
          </p>
          <ul className="uwe-linked-list">
            {similarFacts.map((similar) => (
              <li key={similar.id}>
                <Link href={factDetailHref(worldSlug, similar.id)}>{similar.title}</Link>
                {" — "}
                {BRAIN_STATUS_LABELS[similar.status]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section className="uwe-brain-section">
          <h2>Links</h2>
          <ul>
            {links.map((link) => (
              <li key={link.id}>
                {link.relationType}: {link.targetType} → {link.targetId}
                {link.label ? ` (${link.label})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </WorldShell>
  );
}
