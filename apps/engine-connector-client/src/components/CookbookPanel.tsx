import { useCallback, useEffect, useMemo, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

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

type CatalogSort = "fit" | "strength" | "vram";

const SORT_LABELS: Record<CatalogSort, string> = {
  fit: "Fit",
  strength: "Stärke",
  vram: "VRAM",
};

/** Filled/empty blocks for the 1–5 strength tier. */
function strengthBar(tier: number): string {
  const filled = Math.max(0, Math.min(5, tier));
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

/**
 * Short reason a model got its fit score — the estimator's notes, or a sensible
 * default derived from the fit flags when it emitted none.
 */
function fitReason(model: CookbookModelView): string {
  if (model.fit.notes.length > 0) {
    return model.fit.notes.join(" ");
  }
  if (!model.fit.fitsGpu) {
    return "Überschreitet das verfügbare VRAM — nur mit CPU-Offload oder kleinerer Quantisierung.";
  }
  return "Passt in das VRAM-Budget der erkannten Hardware.";
}

export function CookbookPanel({ onLoadDashboard, onPullModel, onEnableForUwe }: Props) {
  const [dashboard, setDashboard] = useState<CookbookDashboardView | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<CatalogSort>("fit");
  const [onlyGoodFits, setOnlyGoodFits] = useState(true);
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

  // The catalog defaults to "good fits" (≥85%) so the strong-hardware picks stay
  // visible without a wall of unsupported large models; the toggle shows all.
  const FIT_THRESHOLD = 85;
  const visibleModels = useMemo(() => {
    const all = dashboard?.models ?? [];
    const filtered = onlyGoodFits ? all.filter((m) => m.fit.score >= FIT_THRESHOLD) : all;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "strength":
          return b.strengthTier - a.strengthTier || b.paramsB - a.paramsB || b.fit.score - a.fit.score;
        case "vram":
          return b.fit.estimatedVramGb - a.fit.estimatedVramGb || b.fit.score - a.fit.score;
        case "fit":
        default:
          return b.fit.score - a.fit.score || b.paramsB - a.paramsB;
      }
    });
    return sorted;
  }, [dashboard?.models, onlyGoodFits, sortBy]);

  const totalModels = dashboard?.models.length ?? 0;

  return (
    <div className="connector-stack">
      <Card>
        <CardHeader>
          <CardTitle>Hardware-Profil</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button variant="ghost" onClick={loadDashboard} disabled={busy}>
              Neu erkennen
            </Button>
          </div>
        </CardFooter>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Empfehlungen nach Anwendungsfall</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <Button
                      variant="secondary"
                      onClick={() => runPull(rec.modelId)}
                      disabled={activeModel !== null}
                    >
                      Pull via Ollama
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => runEnable(rec.modelId)}
                      disabled={activeModel !== null}
                    >
                      Für UWE aktivieren
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="connector-empty-state">Keine Empfehlungen verfügbar.</div>
          )}
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modell-Katalog mit Fit-Scores</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="connector-stack">
          <div className="connector-catalog-controls">
            <div className="connector-sort-group">
              <span className="connector-muted">Sortieren:</span>
              {(Object.keys(SORT_LABELS) as CatalogSort[]).map((key) => (
                <Button
                  key={key}
                  variant={sortBy === key ? "primary" : "ghost"}
                  onClick={() => setSortBy(key)}
                >
                  {SORT_LABELS[key]}
                </Button>
              ))}
            </div>
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={onlyGoodFits}
                onChange={(event) => setOnlyGoodFits(event.target.checked)}
              />
              <span>Nur gute Fits (≥ {FIT_THRESHOLD} %)</span>
            </label>
          </div>

          <p className="connector-muted">
            Stärke = grobe Leistungsklasse nach Parametern (unabhängig von deiner Hardware). Fit =
            wie gut das Modell auf die erkannte Hardware passt. {visibleModels.length} von{" "}
            {totalModels} Modellen angezeigt.
          </p>

          {dashboard && visibleModels.length > 0 ? (
            <div className="connector-table-wrap">
              <table className="connector-table">
                <thead>
                  <tr>
                    <th>Modell</th>
                    <th>Stärke</th>
                    <th>Größe</th>
                    <th>Fit</th>
                    <th>VRAM</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModels.map((model: CookbookModelView) => (
                    <tr key={model.id}>
                      <td>
                        <div className="connector-table-primary">
                          {model.label}
                          {model.isMoe ? " · MoE" : ""}
                          {model.isMultimodal ? " · Vision" : ""}
                        </div>
                        <div className="connector-table-secondary">{model.id}</div>
                        <div className="connector-table-summary">{model.summary}</div>
                      </td>
                      <td>
                        <span className="connector-strength" title={model.strengthLabel}>
                          {strengthBar(model.strengthTier)}
                        </span>
                        <div className="connector-table-secondary">{model.strengthLabel}</div>
                      </td>
                      <td>{model.paramsB} B</td>
                      <td>
                        <HealthBadge
                          status={fitBadgeStatus(model.fit.level)}
                          label={`${fitLabel(model.fit.level)} · ${model.fit.score}`}
                        />
                        <div className="connector-table-summary">{fitReason(model)}</div>
                      </td>
                      <td>{model.fit.estimatedVramGb} GB</td>
                      <td>{model.installed ? "Installiert" : "Nicht installiert"}</td>
                      <td>
                        <div className="connector-actions">
                          <Button
                            variant="ghost"
                            onClick={() => runPull(model.id)}
                            disabled={activeModel !== null}
                          >
                            Pull
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => runEnable(model.id)}
                            disabled={activeModel !== null}
                          >
                            Für UWE
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="connector-empty-state">
              {busy
                ? "Katalog wird geladen …"
                : totalModels > 0
                  ? "Keine Modelle über der Fit-Schwelle. Deaktiviere den Filter, um alle zu sehen."
                  : "Kein Modell-Katalog verfügbar."}
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
