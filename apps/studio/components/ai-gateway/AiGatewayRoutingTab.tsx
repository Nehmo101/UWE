import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { CLOUD_PROVIDER_PRESETS, ROUTING_LABELS } from "./constants";
import type { GatewayDashboard, RoutingMode } from "./types";

interface ProviderForm {
  providerId: string;
  label: string;
  defaultModel: string;
  apiKey: string;
}

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
    <div className="uwe-section-stack">
      <section className="uwe-v2-card uwe-v2-section">
        <h3>RTX verbinden</h3>
        <p>
          Status: <strong>{data.rtxHealth.ready ? "Erreichbar" : "Nicht erreichbar"}</strong>
        </p>
        <p className="uwe-muted">{data.rtxHealth.message}</p>
        {!data.rtxHealth.ready && data.rtxHealth.connectorOnlineCount === 0 && (
          <p className="uwe-muted">
            Kein live Connector — unter <Link href="/system/rtx-connector">RTX Connector</Link> Token
            anlegen.
          </p>
        )}
      </section>
      <section className="uwe-v2-card uwe-v2-section">
        <h3>Routing-Modus</h3>
        <p className="uwe-muted">
          Standard: <strong>Lokal, dann Cloud</strong> — RTX wird bevorzugt.
        </p>
        <label className="uwe-field">
          Modus
          <select
            className="uwe-input"
            value={data.config.routingMode}
            onChange={(e) => void patchConfig({ routingMode: e.target.value as RoutingMode })}
          >
            {(Object.keys(ROUTING_LABELS) as RoutingMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {ROUTING_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="uwe-v2-card uwe-v2-section">
        <h3>Cloud-Fallback</h3>
        <label className="uwe-checkbox-row">
          <input
            type="checkbox"
            checked={data.config.cloudFallbackEnabled}
            onChange={(e) => void patchConfig({ cloudFallbackEnabled: e.target.checked })}
          />
          Cloud-Fallback global aktivieren
        </label>
      </section>
      <section className="uwe-v2-card uwe-v2-section">
        <h3>Cloud-Provider</h3>
        <p className="uwe-muted">API-Keys werden verschlüsselt gespeichert — nie im Frontend angezeigt.</p>
        <div className="uwe-form-grid">
          <label className="uwe-field">
            Provider
            <select
              className="uwe-input"
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
          </label>
          <label className="uwe-field">
            Standard-Modell
            <input
              className="uwe-input"
              value={providerForm.defaultModel}
              onChange={(e) => setProviderForm((p) => ({ ...p, defaultModel: e.target.value }))}
            />
          </label>
          <label className="uwe-field">
            API-Key (nur beim Setzen/Ersetzen)
            <input
              className="uwe-input"
              type="password"
              autoComplete="off"
              value={providerForm.apiKey}
              onChange={(e) => setProviderForm((p) => ({ ...p, apiKey: e.target.value }))}
            />
          </label>
        </div>
        <button type="button" className="uwe-button-primary" onClick={() => void saveProvider()}>
          Provider speichern
        </button>
        <ul>
          {data.providers.map((p) => (
            <li key={p.id}>
              {p.label} ({p.providerId}) — Key: {p.hasApiKey ? "gesetzt" : "fehlt"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
