import { useCallback, useEffect, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import type {
  CookbookDashboardView,
  CookbookFitLevel,
  CookbookModelView,
  PullOllamaModelResult,
} from "../lib/tauri";
import { useOllamaPullProgress } from "../lib/useOllamaPullProgress";

type Props = {
  onLoadDashboard: () => Promise<CookbookDashboardView>;
  onPullModel: (name: string) => Promise<PullOllamaModelResult>;
  onEnableForUwe: (name: string) => Promise<void>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Unbekannter Fehler";
}

function fitBadgeStatus(level: CookbookFitLevel): "ok" | "degraded" | "error" {
  if (level === "excellent" || level === "good") {
    return "ok";
  }
  if (level === "marginal" || level === "poor") {
    return "degraded";
  }
  return "error";
}

function fitLabel(level: CookbookFitLevel): string {
  switch (level) {
    case "excellent":
      return "Hervorragend";
    case "good":
      return "Gut";
    case "marginal":
      return "Grenzwertig";
    case "poor":
      return "Schwach";
    default:
      return "Nicht unterstützt";
  }
}

export function CookbookPanel({ onLoadDashboard, onPullModel, onEnableForUwe }: Props) {
  const [dashboard, setDashboard] = useState<CookbookDashboardView | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { progress: pullProgress, reset: resetPullProgress } = useOllamaPullProgress();

  const loadDashboard = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setDashboard(await onLoadDashboard());
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [onLoadDashboard]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function runPull(name: string) {
    setActiveModel(name);
    setError(null);
    setNotice(null);
    resetPullProgress();
    try {
      await onPullModel(name);
      setNotice(`Modell „${name}“ wird über Ollama geladen.`);
      await loadDashboard();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveModel(null);
    }
  }

  async function runEnable(name: string) {
    setActiveModel(name);
    setError(null);
    setNotice(null);
    try {
      await onEnableForUwe(name);
      setNotice(`Modell „${name}“ ist jetzt für UWE freigegeben.`);
      await loadDashboard();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveModel(null);
    }
  }

  const hardware = dashboard?.hardware;

  return (
    <div className="connector-stack">
      <CardV2
        title="Hardware-Profil"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="ghost" onClick={loadDashboard} disabled={busy}>
              Neu erkennen
            </ButtonV2>
          </div>
        }
      >
        {hardware ? (
          <div className="connector-stack">
            <div className="connector-stats-row">
              <div className="connector-stat-pill">Backend: {hardware.backend}</div>
              <div className="connector-stat-pill">VRAM gesamt: {hardware.gpuVramGb} GB</div>
              <div className="connector-stat-pill">RAM: {hardware.ramGb} GB</div>
              <div className="connector-stat-pill">CPU-Kerne: {hardware.cpuCores}</div>
            </div>
            {hardware.gpus.length > 0 ? (
              <div className="connector-stats-row">
                {hardware.gpus.map((gpu) => (
                  <div key={gpu.index} className="connector-stat-pill">
                    GPU {gpu.index}: {gpu.name} · {gpu.vramGb} GB
                  </div>
                ))}
              </div>
            ) : (
              <div className="connector-stat-pill">Keine GPU erkannt</div>
            )}
            <p className="connector-muted">{hardware.probeMessage}</p>
          </div>
        ) : (
          <div className="connector-empty-state">
            {busy ? "Hardware wird erkannt …" : "Noch kein Hardware-Profil geladen."}
          </div>
        )}
      </CardV2>

      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
      {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

      {activeModel && pullProgress ? (
        <div className="connector-stack">
          <p className="connector-muted">
            Lädt „{activeModel}“ — {pullProgress.status || "…"}
            {typeof pullProgress.fraction === "number"
              ? ` (${Math.round(pullProgress.fraction * 100)} %)`
              : ""}
          </p>
          <progress className="connector-progress" value={pullProgress.fraction ?? undefined} max={1} />
        </div>
      ) : null}

      <CardV2 title="Empfehlungen nach Anwendungsfall">
        <div className="connector-stack">
          <p className="connector-muted">
            Hardware-bewusste Modellvorschläge aus <code>@uwe/cookbook</code>. Lokale Inferenz
            bevorzugt — Cloud bekommt keinen Brain-/Kampagnenkontext.
          </p>
          {dashboard && dashboard.recommendations.length > 0 ? (
            <div className="connector-profile-list">
              {dashboard.recommendations.map((rec) => (
                <div key={rec.useCase} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <div>
                      <p className="connector-lead">{rec.label}</p>
                      <p className="connector-muted">{rec.description}</p>
                    </div>
                    <HealthBadge
                      status={fitBadgeStatus(rec.fit.level)}
                      label={`${fitLabel(rec.fit.level)} · ${rec.fit.score}`}
                    />
                  </div>
                  <p className="connector-muted">
                    Modell: <strong>{rec.modelLabel}</strong> · Engine: {rec.engineId} · ~
                    {rec.fit.estimatedVramGb} GB VRAM
                  </p>
                  <p className="connector-muted">{rec.privacyNote}</p>
                  <div className="connector-actions">
                    <ButtonV2
                      variant="secondary"
                      onClick={() => runPull(rec.modelId)}
                      disabled={activeModel !== null}
                    >
                      Pull via Ollama
                    </ButtonV2>
                    <ButtonV2
                      variant="primary"
                      onClick={() => runEnable(rec.modelId)}
                      disabled={activeModel !== null}
                    >
                      Für UWE aktivieren
                    </ButtonV2>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="connector-empty-state">Keine Empfehlungen verfügbar.</div>
          )}
        </div>
      </CardV2>

      <CardV2 title="Modell-Katalog mit Fit-Scores">
        {dashboard && dashboard.models.length > 0 ? (
          <div className="connector-table-wrap">
            <table className="connector-table">
              <thead>
                <tr>
                  <th>Modell</th>
                  <th>Größe</th>
                  <th>Fit</th>
                  <th>VRAM (geschätzt)</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.models.map((model: CookbookModelView) => (
                  <tr key={model.id}>
                    <td>
                      <div className="connector-table-primary">{model.label}</div>
                      <div className="connector-table-secondary">{model.id}</div>
                    </td>
                    <td>{model.paramsB} B</td>
                    <td>
                      <HealthBadge
                        status={fitBadgeStatus(model.fit.level)}
                        label={`${fitLabel(model.fit.level)} · ${model.fit.score}`}
                      />
                    </td>
                    <td>{model.fit.estimatedVramGb} GB</td>
                    <td>{model.installed ? "Installiert" : "Nicht installiert"}</td>
                    <td>
                      <div className="connector-actions">
                        <ButtonV2
                          variant="ghost"
                          onClick={() => runPull(model.id)}
                          disabled={activeModel !== null}
                        >
                          Pull
                        </ButtonV2>
                        <ButtonV2
                          variant="secondary"
                          onClick={() => runEnable(model.id)}
                          disabled={activeModel !== null}
                        >
                          Für UWE
                        </ButtonV2>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="connector-empty-state">
            {busy ? "Katalog wird geladen …" : "Kein Modell-Katalog verfügbar."}
          </div>
        )}
      </CardV2>
    </div>
  );
}
