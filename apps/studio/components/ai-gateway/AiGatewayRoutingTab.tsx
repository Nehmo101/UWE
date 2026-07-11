import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";
import { CLOUD_PROVIDER_PRESETS, ROUTING_LABELS } from "./constants";
import type { GatewayDashboard, RoutingMode } from "./types";

interface ProviderForm {
  providerId: string;
  label: string;
  defaultModel: string;
  apiKey: string;
}

/** TODO(design-kit): Controlled Selects (Modus, Provider) bleiben nativ — Kit-Select (Radix)
    ist hier direkt an lokalen State/Props gebunden, siehe gleiches Muster in JobsWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AiGatewayRoutingTab({
  data,
  providerForm,
  setProviderForm,
  patchConfig,
  saveProvider,
}: {
  data: GatewayDashboard;
  providerForm: ProviderForm;
  setProviderForm: Dispatch<SetStateAction<ProviderForm>>;
  patchConfig: (body: Record<string, unknown>) => Promise<void>;
  saveProvider: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>RTX verbinden</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>
            Status: <strong>{data.rtxHealth.ready ? "Erreichbar" : "Nicht erreichbar"}</strong>
          </p>
          <p className="text-sm text-muted-foreground">{data.rtxHealth.message}</p>
          {!data.rtxHealth.ready && data.rtxHealth.connectorOnlineCount === 0 && (
            <p className="text-sm text-muted-foreground">
              Kein live Connector — unter <Link href="/system/rtx-connector">RTX Connector</Link> Token
              anlegen.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Routing-Modus</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Standard: <strong>Lokal, dann Cloud</strong> — RTX wird bevorzugt.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-routing-mode">Modus</Label>
            <select
              id="ai-gateway-routing-mode"
              className={NATIVE_SELECT_CLASS}
              value={data.config.routingMode}
              onChange={(e) => void patchConfig({ routingMode: e.target.value as RoutingMode })}
            >
              {(Object.keys(ROUTING_LABELS) as RoutingMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {ROUTING_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cloud-Fallback</CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.config.cloudFallbackEnabled}
              onChange={(e) => void patchConfig({ cloudFallbackEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Cloud-Fallback global aktivieren
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cloud-Provider</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            API-Keys werden verschlüsselt gespeichert — nie im Frontend angezeigt.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-gateway-provider-id">Provider</Label>
              <select
                id="ai-gateway-provider-id"
                className={NATIVE_SELECT_CLASS}
                value={providerForm.providerId}
                onChange={(e) => {
                  const preset = CLOUD_PROVIDER_PRESETS.find((p) => p.providerId === e.target.value);
                  setProviderForm({
                    providerId: e.target.value,
                    label: preset?.label ?? e.target.value,
                    defaultModel: preset?.defaultModel ?? "",
                    apiKey: "",
                  });
                }}
              >
                {CLOUD_PROVIDER_PRESETS.map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-gateway-provider-model">Standard-Modell</Label>
              <Input
                id="ai-gateway-provider-model"
                value={providerForm.defaultModel}
                onChange={(e) => setProviderForm((p) => ({ ...p, defaultModel: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-gateway-provider-key">API-Key (nur beim Setzen/Ersetzen)</Label>
              <Input
                id="ai-gateway-provider-key"
                type="password"
                autoComplete="off"
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm((p) => ({ ...p, apiKey: e.target.value }))}
              />
            </div>
          </div>
          <Button type="button" onClick={() => void saveProvider()} className="self-start">
            Provider speichern
          </Button>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {data.providers.map((p) => (
              <li key={p.id}>
                {p.label} ({p.providerId}) — Key: {p.hasApiKey ? "gesetzt" : "fehlt"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
