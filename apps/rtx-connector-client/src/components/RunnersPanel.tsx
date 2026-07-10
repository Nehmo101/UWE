import { useCallback, useEffect, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import type {
  RunnerId,
  RunnerProbeResult,
  RunnerStatus,
  RunnerTestResult,
  StartOllamaResult,
} from "../lib/tauri";

type Props = {
  onProbeRunners: () => Promise<RunnerProbeResult[]>;
  onStartOllama: () => Promise<StartOllamaResult>;
  onTestRunner: (id: RunnerId) => Promise<RunnerTestResult>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unbekannter Fehler";
}

function statusBadge(status: RunnerStatus): "ok" | "degraded" | "error" {
  if (status === "online") {
    return "ok";
  }
  return status === "offline" ? "degraded" : "error";
}

function statusLabel(status: RunnerStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    default:
      return "Fehler";
  }
}

export function RunnersPanel({ onProbeRunners, onStartOllama, onTestRunner }: Props) {
  const [runners, setRunners] = useState<RunnerProbeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, RunnerTestResult>>({});

  const loadRunners = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setRunners(await onProbeRunners());
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [onProbeRunners]);

  useEffect(() => {
    void loadRunners();
  }, [loadRunners]);

  async function runStartOllama() {
    setActiveAction("start-ollama");
    setError(null);
    setNotice(null);
    try {
      const result = await onStartOllama();
      setNotice(result.message);
      await loadRunners();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveAction(null);
    }
  }

  async function runTest(id: RunnerId) {
    setActiveAction(`test-${id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await onTestRunner(id);
      setTestResults((current) => ({ ...current, [id]: result }));
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="connector-stack">
      <CardV2
        title="Lokale Runner"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="ghost" onClick={loadRunners} disabled={busy || activeAction !== null}>
              Status aktualisieren
            </ButtonV2>
            <ButtonV2
              variant="primary"
              onClick={runStartOllama}
              disabled={activeAction !== null}
            >
              Ollama starten
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Erkennt Ollama (<code>/api/tags</code>), LM Studio und llama.cpp (<code>/v1/models</code>).
            „Ollama starten“ startet den lokalen Ollama-Dienst auf dem RTX-PC (Windows &amp; Linux).
          </p>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          {runners.length === 0 ? (
            <div className="connector-empty-state">
              {busy ? "Runner werden geprüft …" : "Noch keine Runner geprüft."}
            </div>
          ) : (
            <div className="connector-profile-list">
              {runners.map((runner) => {
                const test = testResults[runner.id];
                return (
                  <div key={runner.id} className="connector-inline-card">
                    <div className="connector-inline-card-header">
                      <div>
                        <p className="connector-lead">{runner.label}</p>
                        <p className="connector-muted">{runner.endpoint}</p>
                      </div>
                      <HealthBadge
                        status={statusBadge(runner.status)}
                        label={statusLabel(runner.status)}
                      />
                    </div>
                    <p className="connector-muted">{runner.message}</p>
                    {runner.models.length > 0 ? (
                      <p className="connector-muted">
                        Modelle: {runner.models.slice(0, 6).join(", ")}
                        {runner.models.length > 6 ? " …" : ""}
                      </p>
                    ) : null}

                    {runner.id === "lm_studio" ? (
                      <p className="connector-muted">
                        Hinweis: LM-Studio-Ausführung ist in P2 nur Sichtbarkeit — Jobs laufen
                        weiterhin über Ollama / RTX-Agent.
                      </p>
                    ) : null}

                    <div className="connector-actions">
                      <ButtonV2
                        variant="secondary"
                        onClick={() => runTest(runner.id)}
                        disabled={activeAction !== null}
                      >
                        Verbindung testen
                      </ButtonV2>
                    </div>

                    {test ? (
                      <p className="connector-muted">
                        Test: {statusLabel(test.status)} — {test.message}
                        {test.speed && test.speed.tokensPerSecond !== null
                          ? ` · ${test.speed.tokensPerSecond} Tokens/s`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardV2>
    </div>
  );
}
