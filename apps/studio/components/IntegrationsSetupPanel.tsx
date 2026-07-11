"use client";

import Link from "next/link";

interface WorldSummary {
  slug: string;
  name: string;
}

interface SpotifyOAuthSummary {
  configured: boolean;
  redirectUri: string | null;
}

interface ImageStudioSummary {
  enabled: boolean;
  connectorImageEnabled: boolean;
  localImageBackendReady: boolean;
  cloudApiKeyConfigured: boolean;
}

interface CalendarSummary {
  enabled: boolean;
  caldavEnabled: boolean;
}

interface AgentJobsSummary {
  enabled: boolean;
  githubTokenConfigured: boolean;
}

interface DndApiSummary {
  open5eEnabled: boolean;
  dnd5eSrdEnabled: boolean;
}

export interface IntegrationsSetupPanelProps {
  worlds: WorldSummary[];
  spotifyOAuth: SpotifyOAuthSummary;
  imageStudio: ImageStudioSummary;
  calendar: CalendarSummary;
  agentJobs: AgentJobsSummary;
  dndApi: DndApiSummary;
}

const DT_CLASS = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const DD_CLASS = "text-sm";
const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";
const LINK_CLASS = "text-primary underline-offset-4 hover:underline";

function statusLabel(active: boolean, activeLabel = "aktiv", inactiveLabel = "deaktiviert") {
  return active ? activeLabel : inactiveLabel;
}

function configuredLabel(configured: boolean) {
  return configured ? "konfiguriert" : "nicht konfiguriert";
}

export function IntegrationsSetupPanel({
  worlds,
  spotifyOAuth,
  imageStudio,
  calendar,
  agentJobs,
  dndApi,
}: IntegrationsSetupPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Spotify Soundboard</h3>
        <p className="text-sm text-muted-foreground">
          OAuth-Credentials nur serverseitig in <code>.env</code> (
          <code>SPOTIFY_CLIENT_ID</code>, <code>SPOTIFY_CLIENT_SECRET</code>). Verbindung pro Welt
          auf der Soundboard-Seite.
        </p>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className={DT_CLASS}>OAuth ENV</dt>
            <dd className={DD_CLASS}>{configuredLabel(spotifyOAuth.configured)}</dd>
          </div>
          {spotifyOAuth.redirectUri && (
            <div>
              <dt className={DT_CLASS}>Redirect-URI</dt>
              <dd className={DD_CLASS}>
                <code>{spotifyOAuth.redirectUri}</code>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Spotify pro Welt</h3>
        {worlds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Welten vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Welt</th>
                  <th className={TH_CLASS}>Soundboard</th>
                </tr>
              </thead>
              <tbody>
                {worlds.map((world) => (
                  <tr key={world.slug}>
                    <td className={TD_CLASS}>{world.name}</td>
                    <td className={TD_CLASS}>
                      <Link
                        href={`/worlds/${encodeURIComponent(world.slug)}/soundboard`}
                        className={LINK_CLASS}
                      >
                        /worlds/{world.slug}/soundboard
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Weitere Integrationen</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH_CLASS}>Feature</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>Image Studio</td>
                <td className={TD_CLASS}>
                  {statusLabel(imageStudio.enabled)}
                  {" · "}
                  Connector: {imageStudio.connectorImageEnabled ? "Queue an" : "aus"}
                  {" · "}
                  Lokal: {imageStudio.localImageBackendReady ? "OK" : "fehlt"}
                  {" · "}
                  Cloud-Key: {imageStudio.cloudApiKeyConfigured ? "OK" : "fehlt"}
                </td>
                <td className={TD_CLASS}>
                  <Link href="/image-studio" className={LINK_CLASS}>
                    /image-studio
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Kalender</td>
                <td className={TD_CLASS}>
                  {statusLabel(calendar.enabled)}
                  {calendar.enabled && (
                    <>
                      {" · "}
                      CalDAV: {calendar.caldavEnabled ? "an" : "aus"}
                    </>
                  )}
                </td>
                <td className={TD_CLASS}>
                  <Link href="/calendar" className={LINK_CLASS}>
                    /calendar
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Agent Jobs</td>
                <td className={TD_CLASS}>
                  {statusLabel(agentJobs.enabled)}
                  {" · "}
                  GitHub-Token: {agentJobs.githubTokenConfigured ? "OK" : "fehlt"}
                </td>
                <td className={TD_CLASS}>
                  <Link href="/admin/agent-jobs" className={LINK_CLASS}>
                    /admin/agent-jobs
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>DnD API (Open5e/SRD)</td>
                <td className={TD_CLASS}>
                  Open5e: {dndApi.open5eEnabled ? "an" : "aus"} · SRD:{" "}
                  {dndApi.dnd5eSrdEnabled ? "an" : "aus"}
                </td>
                <td className={TD_CLASS}>Welt → DnD API</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Siehe <code>.env.example</code> für IMAGE_STUDIO_*, CALENDAR_*, AGENT_JOBS_* und SPOTIFY_*.
          Mail-SMTP kann alternativ unter Tab Mail konfiguriert werden.
        </p>
      </section>
    </div>
  );
}
