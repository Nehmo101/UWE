"use client";

import { CopyToClipboardButton } from "@uwe/shared-ui";
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

interface WebhookDelivery {
  id: string;
  endpointId: string;
  endpointName: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function WebhookWorkspace() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    const response = await fetch(studioApiUrl("/api/admin/webhooks/deliveries?limit=25&failedOnly=0"));
    if (!response.ok) return;
    const data = (await response.json()) as {
      deliveries: WebhookDelivery[];
      total: number;
    };
    setDeliveries(data.deliveries);
    setDeliveryTotal(data.total);
  }, []);

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
      await loadDeliveries();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [loadDeliveries]);

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

  async function retryDelivery(deliveryId: string) {
    setRetryingId(deliveryId);
    setError(null);
    try {
      const response = await fetch(studioApiUrl(`/api/admin/webhooks/deliveries/${deliveryId}/retry`), {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Retry fehlgeschlagen.");
      }
      await loadDeliveries();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry fehlgeschlagen.");
    } finally {
      setRetryingId(null);
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
  }

  return (
    <>
      <section className="uwe-v2-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Webhook-Endpunkt</h2>
        <p className="uwe-dashboard-muted">
          Outbound-Webhooks mit HMAC-Signatur. Private/localhost URLs werden blockiert (SSRF-Schutz).
          Das Signing Secret wird nur einmal nach der Erstellung angezeigt.
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
        <button type="button" className="uwe-v2-btn uwe-v2-btn-primary" onClick={() => void createWebhook()}>
          Webhook erstellen
        </button>
        {createdSecret && (
          <div className="uwe-notice uwe-notice-warn" style={{ marginTop: "1rem" }}>
            <p>
              <strong>Signing Secret (nur einmal):</strong> <code>{createdSecret}</code>
            </p>
            <CopyToClipboardButton text={createdSecret} label="Secret kopieren" />
          </div>
        )}
      </section>

      {error && <p className="uwe-notice uwe-notice-error">{error}</p>}

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
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

      <section className="uwe-v2-card">
        <h2>Delivery-Log ({deliveryTotal})</h2>
        {deliveries.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch keine Deliveries protokolliert.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Endpunkt</th>
                <th>Event</th>
                <th>Status</th>
                <th>Fehler</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td>{formatStudioDate(delivery.createdAt)}</td>
                  <td>{delivery.endpointName}</td>
                  <td>{delivery.event}</td>
                  <td>
                    {delivery.success
                      ? `OK${delivery.statusCode ? ` (${delivery.statusCode})` : ""}`
                      : "Fehlgeschlagen"}
                  </td>
                  <td>{delivery.errorMessage ?? "—"}</td>
                  <td>
                    {!delivery.success ? (
                      <button
                        type="button"
                        className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                        disabled={retryingId === delivery.id}
                        onClick={() => void retryDelivery(delivery.id)}
                      >
                        {retryingId === delivery.id ? "…" : "Retry"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
