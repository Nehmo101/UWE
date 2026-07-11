"use client";

import { CopyToClipboardButton } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/src/components/ui";

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

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook-Endpunkt</CardTitle>
          <CardDescription>
            Outbound-Webhooks mit HMAC-Signatur. Private/localhost URLs werden blockiert (SSRF-Schutz).
            Das Signing Secret wird nur einmal nach der Erstellung angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="webhook-name">Name</Label>
            <Input id="webhook-name" type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="webhook-url">URL (https)</Label>
            <Input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/hooks/uwe"
            />
          </div>
          {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
          <fieldset className="flex flex-col gap-2 rounded-[var(--radius)] border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">Events</legend>
            {events.map((event) => (
              <label key={event} className={CHECKBOX_ROW_CLASS}>
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className={CHECKBOX_CLASS}
                />
                {event}
              </label>
            ))}
          </fieldset>
          <Button type="button" onClick={() => void createWebhook()} className="self-start">
            Webhook erstellen
          </Button>
          {createdSecret && (
            <Alert tone="warning">
              <p>
                <strong>Signing Secret (nur einmal):</strong> <code>{createdSecret}</code>
              </p>
              <CopyToClipboardButton text={createdSecret} label="Secret kopieren" />
            </Alert>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Endpunkte ({endpoints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : endpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Webhooks konfiguriert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Name</th>
                    <th className={TH_CLASS}>URL</th>
                    <th className={TH_CLASS}>Secret</th>
                    <th className={TH_CLASS}>Events</th>
                    <th className={TH_CLASS}>Zuletzt</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((endpoint) => (
                    <tr key={endpoint.id}>
                      <td className={TD_CLASS}>{endpoint.name}</td>
                      <td className={TD_CLASS}>{endpoint.url}</td>
                      <td className={TD_CLASS}>
                        <code>{endpoint.secretPrefix}…</code>
                      </td>
                      <td className={TD_CLASS}>{endpoint.events.join(", ")}</td>
                      <td className={TD_CLASS}>{endpoint.lastTriggeredAt ? formatStudioDate(endpoint.lastTriggeredAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery-Log ({deliveryTotal})</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Deliveries protokolliert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Zeit</th>
                    <th className={TH_CLASS}>Endpunkt</th>
                    <th className={TH_CLASS}>Event</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Fehler</th>
                    <th className={TH_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className={TD_CLASS}>{formatStudioDate(delivery.createdAt)}</td>
                      <td className={TD_CLASS}>{delivery.endpointName}</td>
                      <td className={TD_CLASS}>{delivery.event}</td>
                      <td className={TD_CLASS}>
                        {delivery.success
                          ? `OK${delivery.statusCode ? ` (${delivery.statusCode})` : ""}`
                          : "Fehlgeschlagen"}
                      </td>
                      <td className={TD_CLASS}>{delivery.errorMessage ?? "—"}</td>
                      <td className={TD_CLASS}>
                        {!delivery.success ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={retryingId === delivery.id}
                            onClick={() => void retryDelivery(delivery.id)}
                          >
                            {retryingId === delivery.id ? "…" : "Retry"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
