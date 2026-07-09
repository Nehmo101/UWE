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
      <form action={createGameSessionAction} className="uwe-edit-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />

        <label>
          Titel
          <input name="title" required placeholder="Session 3 — Der Turm" autoFocus />
        </label>

        <label>
          Kampagne
          <select name="campaignSlug" defaultValue={campaignSlug ?? ""}>
            <option value="">Keine Kampagne</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>

        <label>
          Datum
          <input type="date" name="date" />
        </label>

        <details className="uwe-v2-section">
          <summary className="uwe-v2-section-title" style={{ cursor: "pointer" }}>
            Erweiterte Felder (optional)
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <label>
              Status
              <select name="status" defaultValue="planned">
                {Object.values(GameSessionStatusEnum).map((status) => (
                  <option key={status} value={status}>
                    {GAME_SESSION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              DM-Notizen (Vorbereitung)
              <textarea name="summaryDm" rows={3} placeholder="Was plant der DM?" />
            </label>

            <label>
              Spieler-Recap (Entwurf)
              <textarea name="summaryPlayer" rows={3} placeholder="Was erfahren die Spieler?" />
            </label>

            <label>
              Notizen
              <textarea name="notes" rows={2} />
            </label>

            <label>
              Offene Plots
              <textarea name="openPlots" rows={2} placeholder="Welche Handlungsstränge sind offen?" />
            </label>

            <label>
              Spielerentscheidungen
              <textarea name="playerDecisions" rows={2} placeholder="Was haben die Spieler entschieden?" />
            </label>
          </div>
        </details>

        <div className="uwe-form-actions">
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Session erstellen</button>
          <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/sessions`}>
            Abbrechen
          </Link>
        </div>
      </form>
    </WorldShell>
  );
}
