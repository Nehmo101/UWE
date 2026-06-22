"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secretPrefix: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
}

export function WebhookWorkspace() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/webhooks"));
      if (!response.ok) {
        throw new Error(`Webhooks konnten nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as {
        endpoints: WebhookEndpoint[];
        availableEvents: string[];
      };
      setEndpoints(data.endpoints);
      setEvents(data.availableEvents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWebhook() {
    setError(null);
    setCreatedSecret(null);
    const response = await fetch(studioApiUrl("/api/admin/webhooks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, events: selectedEvents }),
    });
    const data = (await response.json()) as { plaintextSecret?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Webhook konnte nicht erstellt werden.");
      return;
    }
    setCreatedSecret(data.plaintextSecret ?? null);
    setName("");
    setUrl("");
    setSelectedEvents([]);
    await load();
  }

  function toggleEvent(event: string) {
    setSelectedEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
  }

  return (
    <>
      <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Webhook-Endpunkt</h2>
        <p className="uwe-dashboard-muted">
          Outbound-Webhooks mit HMAC-Signatur. Private/localhost URLs werden blockiert (SSRF-Schutz).
        </p>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          URL (https)
          <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/hooks/uwe" />
        </label>
        <fieldset>
          <legend>Events</legend>
          {events.map((event) => (
            <label key={event} className="uwe-checkbox-label">
              <input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => toggleEvent(event)} />
              {event}
            </label>
          ))}
        </fieldset>
        <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void createWebhook()}>
          Webhook erstellen
        </button>
        {createdSecret && (
          <p className="uwe-notice uwe-notice-warn" style={{ marginTop: "1rem" }}>
            <strong>Signing Secret (nur einmal):</strong> <code>{createdSecret}</code>
          </p>
        )}
      </section>

      {error && <p className="uwe-notice uwe-notice-error">{error}</p>}

      <section className="uwe-card">
        <h2>Endpunkte ({endpoints.length})</h2>
        {loading ? (
          <p className="uwe-dashboard-muted">Lade…</p>
        ) : endpoints.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine Webhooks konfiguriert.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Secret</th>
                <th>Events</th>
                <th>Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id}>
                  <td>{endpoint.name}</td>
                  <td>{endpoint.url}</td>
                  <td>
                    <code>{endpoint.secretPrefix}…</code>
                  </td>
                  <td>{endpoint.events.join(", ")}</td>
                  <td>{endpoint.lastTriggeredAt ? formatStudioDate(endpoint.lastTriggeredAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
