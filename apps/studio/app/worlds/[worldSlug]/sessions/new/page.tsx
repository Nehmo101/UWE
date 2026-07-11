import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GAME_SESSION_STATUS_LABELS,
} from "@uwe/shared-ui";
import {
  GameSessionStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { createGameSessionAction } from "../../../../session-actions";
import { Button, buttonVariants, Input, Label, Textarea } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function StudioNewSessionPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Sessions",
            `/worlds/${worldSlug}/sessions`,
            "Neu",
          )}
        />
      }
    >
      <PageHeader
        title="Neue Session"
        summary="Schnellanlage mit Titel, Kampagne und Datum — weitere Felder optional."
      />
      <form action={createGameSessionAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-title">Titel</Label>
          <Input id="session-title" name="title" required placeholder="Session 3 — Der Turm" autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-campaign">Kampagne</Label>
          {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
              "Keine Kampagne" — natives Select beibehalten. */}
          <select
            id="session-campaign"
            name="campaignSlug"
            defaultValue={campaignSlug ?? ""}
            className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Keine Kampagne</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-date">Datum</Label>
          <Input id="session-date" type="date" name="date" />
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-semibold tracking-tight text-foreground">
            Erweiterte Felder (optional)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-status">Status</Label>
              {/* TODO(design-kit): natives Select statt Kit-Select — konsistent mit
                  Kampagnen-Auswahl oben, kein Leerwert nötig, aber gleiche Formsprache. */}
              <select
                id="session-status"
                name="status"
                defaultValue="planned"
                className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.values(GameSessionStatusEnum).map((status) => (
                  <option key={status} value={status}>
                    {GAME_SESSION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-summary-dm">DM-Notizen (Vorbereitung)</Label>
              <Textarea id="session-summary-dm" name="summaryDm" rows={3} placeholder="Was plant der DM?" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-summary-player">Spieler-Recap (Entwurf)</Label>
              <Textarea
                id="session-summary-player"
                name="summaryPlayer"
                rows={3}
                placeholder="Was erfahren die Spieler?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-notes">Notizen</Label>
              <Textarea id="session-notes" name="notes" rows={2} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-open-plots">Offene Plots</Label>
              <Textarea
                id="session-open-plots"
                name="openPlots"
                rows={2}
                placeholder="Welche Handlungsstränge sind offen?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-player-decisions">Spielerentscheidungen</Label>
              <Textarea
                id="session-player-decisions"
                name="playerDecisions"
                rows={2}
                placeholder="Was haben die Spieler entschieden?"
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Session erstellen</Button>
          <Link className={buttonVariants({ variant: "ghost" })} href={`/worlds/${worldSlug}/sessions`}>
            Abbrechen
          </Link>
        </div>
      </form>
    </WorldShell>
  );
}
