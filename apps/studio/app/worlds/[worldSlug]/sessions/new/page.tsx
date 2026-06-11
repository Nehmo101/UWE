import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  GAME_SESSION_STATUS_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  GameSessionStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
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
  if (!world) return null;

  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Neue Session" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Sessions", href: `/worlds/${worldSlug}/sessions` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
              { label: "Neu" },
            ]}
          />
          <PageHeader title="Neue Session" summary="Session für Vorbereitung und Spielabend anlegen." />

          <form action={createGameSessionAction} className="uwe-edit-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />

            <label>
              Titel
              <input name="title" required placeholder="Session 3 — Der Turm" />
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
              <textarea name="summaryDm" rows={4} placeholder="Was plant der DM?" />
            </label>

            <label>
              Spieler-Recap (Entwurf)
              <textarea name="summaryPlayer" rows={4} placeholder="Was erfahren die Spieler?" />
            </label>

            <label>
              Notizen
              <textarea name="notes" rows={3} />
            </label>

            <label>
              Offene Plots
              <textarea name="openPlots" rows={3} placeholder="Welche Handlungsstränge sind offen?" />
            </label>

            <label>
              Spielerentscheidungen
              <textarea name="playerDecisions" rows={3} placeholder="Was haben die Spieler entschieden?" />
            </label>

            <div className="uwe-form-actions">
              <button type="submit" className="uwe-btn uwe-btn-primary">Session erstellen</button>
              <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/sessions`}>
                Abbrechen
              </Link>
            </div>
          </form>
        </>
      }
    />
  );
}
