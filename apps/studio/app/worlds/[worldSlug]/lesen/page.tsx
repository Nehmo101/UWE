import Link from "next/link";
import { notFound } from "next/navigation";

import { getAppRepository } from "@uwe/database/server";
import { MIN_QUERY_LENGTH, normalizeQuery } from "@uwe/session-runner";

import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { Card, CardContent, EmptyState } from "@/src/components/ui";
import { VolumeSearchForm, VolumeSearchHits, matchLabel } from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { listVolumes, searchVolumes } from "@/src/lib/volume-reader";
import { createCampaignService } from "@uwe/database/campaign";
import { prisma } from "@uwe/database/server";

import { VolumeCampaignForm } from "./VolumeCampaignForm";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; hinweis?: string; fehler?: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Die Bände einer Welt.
 *
 * Ein Band ist eine Seite mit Unterseiten, die selbst unter keiner hängt — nach
 * einem Dokument-Import genau das importierte Buch. Hier steht, was sich am
 * Stück lesen lässt; das Nachschlagen bleibt im Wiki.
 *
 * Mit `?q=` wird über alle Bände gesucht. Das ist die Frage, die weder die
 * Browsersuche (die kennt nur den geladenen Band) noch die globale Suche (die
 * findet Seiten, nicht Stellen) beantwortet: „in welchem Buch stand das, und wo?"
 */
export default async function StudioVolumesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, hinweis, fehler } = await searchParams;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const query = normalizeQuery(q);
  const campaignService = createCampaignService(prisma);
  const [volumes, groups, candidates, campaigns] = await Promise.all([
    listVolumes(worldSlug),
    searchVolumes(worldSlug, query),
    campaignService.listVolumeCandidates(worldSlug),
    campaignService.listOverview(worldSlug),
  ]);

  // Nach Seiten-ID nachschlagen: `listVolumes` liefert den Lesetext, der Service
  // die Kampagnenzuordnung. Beide meinen dieselbe Wurzelseite.
  const candidateById = new Map(candidates.map((entry) => [entry.pageId, entry]));
  const freieDungeons = candidates.filter((entry) => entry.isDungeon && !entry.campaignId);

  const totalMatches = groups.reduce((total, group) => total + group.matches, 0);
  const base = `/worlds/${worldSlug}/lesen`;

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Lesen", base)} />
      <PageHeader
        title="Lesen"
        summary="Kampagnen, Dungeons und Bände am Stück — in der Reihenfolge, in der sie geschrieben wurden."
      />

      {hinweis ? (
        <p className="mb-4 rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm">
          {hinweis}
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {fehler}
        </p>
      ) : null}

      <VolumeSearchForm
        action={base}
        query={q ?? ""}
        placeholder="In allen Bänden suchen…"
        label="In allen Bänden suchen"
      />

      {query ? (
        groups.length === 0 ? (
          <Card className="mb-6">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Keine Treffer für „{query}“ — gesucht wird nur in Bänden. Einzelne Wiki-Seiten
              findet die{" "}
              <Link href={`/search?q=${encodeURIComponent(query)}&world=${worldSlug}`} className="underline">
                globale Suche
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <section className="mb-8 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {matchLabel(totalMatches)} für „{query}“ in{" "}
              {groups.length === 1 ? "einem Band" : `${groups.length} Bänden`}.
            </p>
            {groups.map((group) => (
              <Card key={group.volume.id}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`${base}/${group.volume.slug}?q=${encodeURIComponent(query)}`}
                      className="text-base font-semibold hover:underline"
                    >
                      {group.volume.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {matchLabel(group.matches)} in{" "}
                      {group.hits.length === 1 ? "einem Abschnitt" : `${group.hits.length} Abschnitten`}
                    </span>
                  </div>
                  <VolumeSearchHits
                    hits={group.hits}
                    // Der Treffer öffnet den Band **mit** der Suche: dort steht
                    // die Stelle markiert im Lesetext, nicht nur als Ausschnitt.
                    hrefFor={(hit) =>
                      `${base}/${group.volume.slug}?q=${encodeURIComponent(query)}#${hit.anchor}`
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </section>
        )
      ) : q?.trim() ? (
        <p className="mb-6 text-sm text-muted-foreground">
          Mindestens {MIN_QUERY_LENGTH} Zeichen, sonst trifft die Suche alles.
        </p>
      ) : null}

      {volumes.length === 0 ? (
        <EmptyState
          title="Noch nichts zu lesen"
          description="Bände entstehen beim Dokument-Import oder sobald eine Seite Unterseiten bekommt."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
          {volumes.map((volume) => (
            <Card key={volume.id}>
              <CardContent className="pt-6">
                <Link href={`${base}/${volume.slug}`} className="text-base font-semibold">
                  {volume.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {volume.pageCount} Abschnitte
                </p>
                {candidateById.has(volume.id) ? (
                  <VolumeCampaignForm
                    worldSlug={worldSlug}
                    volume={candidateById.get(volume.id)!}
                    dungeons={freieDungeons.filter((entry) => entry.pageId !== volume.id)}
                    campaigns={campaigns.map((entry) => ({ id: entry.id, name: entry.name }))}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
