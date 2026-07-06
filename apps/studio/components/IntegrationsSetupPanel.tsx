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
    <div className="uwe-settings-stack">
      <section className="uwe-form">
        <h3>Spotify Soundboard</h3>
        <p className="uwe-hint">
          OAuth-Credentials nur serverseitig in <code>.env</code> (
          <code>SPOTIFY_CLIENT_ID</code>, <code>SPOTIFY_CLIENT_SECRET</code>). Verbindung pro Welt
          auf der Soundboard-Seite.
        </p>
        <dl className="uwe-dl">
          <div>
            <dt>OAuth ENV</dt>
            <dd>{configuredLabel(spotifyOAuth.configured)}</dd>
          </div>
          {spotifyOAuth.redirectUri && (
            <div>
              <dt>Redirect-URI</dt>
              <dd>
                <code>{spotifyOAuth.redirectUri}</code>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="uwe-form">
        <h3>Spotify pro Welt</h3>
        {worlds.length === 0 ? (
          <p className="uwe-hint">Noch keine Welten vorhanden.</p>
        ) : (
          <div className="uwe-page-table-wrap">
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Welt</th>
                  <th>Soundboard</th>
                </tr>
              </thead>
              <tbody>
                {worlds.map((world) => (
                  <tr key={world.slug}>
                    <td>{world.name}</td>
                    <td>
                      <Link href={`/worlds/${encodeURIComponent(world.slug)}/soundboard`}>
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

      <section className="uwe-form">
        <h3>Weitere Integrationen</h3>
        <div className="uwe-page-table-wrap">
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Image Studio</td>
                <td>
                  {statusLabel(imageStudio.enabled)}
                  {" · "}
                  Connector: {imageStudio.connectorImageEnabled ? "Queue an" : "aus"}
                  {" · "}
                  Lokal: {imageStudio.localImageBackendReady ? "OK" : "fehlt"}
                  {" · "}
                  Cloud-Key: {imageStudio.cloudApiKeyConfigured ? "OK" : "fehlt"}
                </td>
                <td>
                  <Link href="/image-studio">/image-studio</Link>
                </td>
              </tr>
              <tr>
                <td>Kalender</td>
                <td>
                  {statusLabel(calendar.enabled)}
                  {calendar.enabled && (
                    <>
                      {" · "}
                      CalDAV: {calendar.caldavEnabled ? "an" : "aus"}
                    </>
                  )}
                </td>
                <td>
                  <Link href="/calendar">/calendar</Link>
                </td>
              </tr>
              <tr>
                <td>Agent Jobs</td>
                <td>
                  {statusLabel(agentJobs.enabled)}
                  {" · "}
                  GitHub-Token: {agentJobs.githubTokenConfigured ? "OK" : "fehlt"}
                </td>
                <td>
                  <Link href="/admin/agent-jobs">/admin/agent-jobs</Link>
                </td>
              </tr>
              <tr>
                <td>DnD API (Open5e/SRD)</td>
                <td>
                  Open5e: {dndApi.open5eEnabled ? "an" : "aus"} · SRD:{" "}
                  {dndApi.dnd5eSrdEnabled ? "an" : "aus"}
                </td>
                <td>Welt → DnD API</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="uwe-hint">
          Siehe <code>.env.example</code> für IMAGE_STUDIO_*, CALENDAR_*, AGENT_JOBS_* und SPOTIFY_*.
          Mail-SMTP kann alternativ unter Tab Mail konfiguriert werden.
        </p>
      </section>
    </div>
  );
}
