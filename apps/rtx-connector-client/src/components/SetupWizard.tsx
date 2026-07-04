import { useEffect, useMemo, useState } from "react";

import {
  maskToken,
  parseConnectorClientConfig,
  validateHostUrl,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";
import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import {
  getConnectorStatus,
  startConnector,
  testHostConnection,
  writeConfig,
  type HostConnectionTestResult,
} from "../lib/tauri";

type WizardStep = {
  id: number;
  title: string;
  description: string;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: "Host URL",
    description: "Trage die öffentliche oder LAN-Adresse deines UWE Hosts ein.",
  },
  {
    id: 2,
    title: "Connector Token",
    description: "Füge den Token aus Studio → System → RTX Connector ein.",
  },
  {
    id: 3,
    title: "Connector Name",
    description: "Vergib einen Anzeigenamen für diesen RTX-Rechner.",
  },
  {
    id: 4,
    title: "Verbindung testen",
    description: "Prüfe Host-Erreichbarkeit und Token-Gültigkeit.",
  },
  {
    id: 5,
    title: "Lokale Runner",
    description: "Ollama, LM Studio und llama.cpp werden in Phase P2 geprüft.",
  },
  {
    id: 6,
    title: "Erstes Modell",
    description: "Modell-Download und Bibliothek folgen in Phase P1.",
  },
  {
    id: 7,
    title: "UWE-Freigabe",
    description: "Einzelne Modell-Freigaben folgen in Phase P1.",
  },
  {
    id: 8,
    title: "Fertig",
    description: "Der Connector kann jetzt gestartet werden.",
  },
];

type Props = {
  initialConfig: ConnectorClientConfig;
  initialModelStore: ConnectorModelProfileStore;
  modelStoreLoaded: boolean;
  loadModelStore: () => Promise<ConnectorModelProfileStore>;
  saveModelStore: (store: ConnectorModelProfileStore) => Promise<ConnectorModelProfileStore>;
  scanModels: () => Promise<ConnectorModelProfileStore>;
  onCompleted: (config: ConnectorClientConfig) => void;
  onDismiss: () => void;
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

export function SetupWizard({
  initialConfig,
  initialModelStore,
  modelStoreLoaded,
  loadModelStore,
  saveModelStore,
  scanModels,
  onCompleted,
  onDismiss,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [config, setConfig] = useState<ConnectorClientConfig>(initialConfig);
  const [modelStore, setModelStore] = useState<ConnectorModelProfileStore>(initialModelStore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HostConnectionTestResult | null>(null);
  const [scanAttempted, setScanAttempted] = useState(false);

  const step = WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  useEffect(() => {
    setModelStore(initialModelStore);
  }, [initialModelStore]);

  useEffect(() => {
    if (step.id < 6 || modelStoreLoaded) {
      return;
    }

    void (async () => {
      setBusy(true);
      setError(null);
      try {
        setModelStore(await loadModelStore());
      } catch (nextError) {
        setError(toMessage(nextError));
      } finally {
        setBusy(false);
      }
    })();
  }, [loadModelStore, modelStoreLoaded, step.id]);

  const canAdvance = useMemo(() => {
    switch (step.id) {
      case 1:
        return validateHostUrl(config.hostUrl).ok;
      case 2:
        return config.token.trim().length > 0;
      case 3:
        return config.name.trim().length > 0;
      case 4:
        // The connection test is recommended but must not trap the user during
        // first-run (the host may not be reachable yet). Entered values are
        // persisted regardless, so the wizard can always be completed.
        return true;
      case 6:
        return scanAttempted || modelStore.profiles.length > 0;
      case 7:
        return modelStore.profiles.length === 0 || modelStore.profiles.some((profile) => profile.enabledForUwe);
      default:
        return true;
    }
  }, [
    config.hostUrl,
    config.name,
    config.token,
    modelStore.profiles,
    scanAttempted,
    step.id,
  ]);

  function updateConfig<K extends keyof ConnectorClientConfig>(
    key: K,
    value: ConnectorClientConfig[K],
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
    if (key === "hostUrl" || key === "token") {
      setTestResult(null);
    }
  }

  async function runConnectionTest() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result = await testHostConnection(config.hostUrl, config.token);
      setTestResult(result);
      setNotice(result.ok ? "Verbindung steht." : null);
      if (!result.ok) {
        setError(result.message);
      }
      // Persist the tested host/token/name so they survive even if the user
      // closes the app right after testing.
      await saveDraftQuietly();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function finishWizard() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await writeConfig(
        parseConnectorClientConfig({
          ...config,
          wizardCompleted: true,
        }),
      );

      if (saved.autoConnect) {
        await startConnector();
        await getConnectorStatus();
      }

      onCompleted(saved);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Persist the entered values to disk without completing the wizard. Best-effort:
   * an invalid partial config (e.g. host not yet valid) is simply skipped, so this
   * never interrupts the flow. This is what guarantees the host/token/name survive
   * even if the app is closed mid-wizard or the connection test can't be run yet.
   */
  async function saveDraftQuietly() {
    try {
      await writeConfig(parseConnectorClientConfig({ ...config, wizardCompleted: false }));
    } catch {
      // Partial/invalid drafts are fine to skip — the final "Fertig" step validates.
    }
  }

  async function goNext() {
    // Save progress as the user moves through the credential steps.
    if (step.id >= 1 && step.id <= 4) {
      await saveDraftQuietly();
    }
    setStepIndex((value) => value + 1);
  }

  async function handleDismiss() {
    await saveDraftQuietly();
    onDismiss();
  }

  async function runModelScan() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const scanned = await scanModels();
      setModelStore(scanned);
      setScanAttempted(true);
      setNotice(
        scanned.profiles.length > 0
          ? `${scanned.profiles.length} Modelle gefunden.`
          : "Scan abgeschlossen. Noch keine Modelle gefunden.",
      );
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function enableProfileForUwe(profileId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await saveModelStore({
        ...modelStore,
        profiles: modelStore.profiles.map((profile) =>
          profile.id === profileId ? { ...profile, enabledForUwe: true } : profile,
        ),
      });
      setModelStore(saved);
      setNotice("Modell für UWE freigegeben.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  function renderStepBody() {
    switch (step.id) {
      case 1:
        return (
          <label className="connector-field connector-field-full">
            <span>UWE Host URL</span>
            <input
              className="connector-input"
              value={config.hostUrl}
              onChange={(event) => updateConfig("hostUrl", event.target.value)}
              placeholder="https://uwe.example.org"
            />
          </label>
        );
      case 2:
        return (
          <label className="connector-field connector-field-full">
            <span>Connector Token</span>
            <input
              className="connector-input"
              type="password"
              value={config.token}
              onChange={(event) => updateConfig("token", event.target.value)}
              placeholder="uwec_..."
            />
          </label>
        );
      case 3:
        return (
          <label className="connector-field connector-field-full">
            <span>Connector Name</span>
            <input
              className="connector-input"
              value={config.name}
              onChange={(event) => updateConfig("name", event.target.value)}
              placeholder="RTX Arbeitszimmer"
            />
          </label>
        );
      case 4:
        return (
          <div className="connector-stack">
            <p className="connector-muted">
              Host: <strong>{config.hostUrl || "—"}</strong> · Token:{" "}
              <strong>{maskToken(config.token) || "—"}</strong>
            </p>
            <div className="connector-actions">
              <ButtonV2 variant="secondary" onClick={runConnectionTest} disabled={busy}>
                Verbindung testen
              </ButtonV2>
            </div>
            {testResult ? (
              <HealthBadge
                status={testResult.ok ? "ok" : "error"}
                label={testResult.ok ? "Verbindung OK" : "Test fehlgeschlagen"}
              />
            ) : null}
            {testResult ? <p className="connector-muted">{testResult.message}</p> : null}
            {testResult?.ok ? null : (
              <p className="connector-muted">
                Der Test ist empfohlen, aber optional — du kannst auch ohne erfolgreichen Test
                fortfahren. Deine Angaben werden gespeichert.
              </p>
            )}
          </div>
        );
      case 5:
        return (
          <p className="connector-muted">
            Dieser Schritt wird in einer späteren Phase automatisiert. Du kannst ihn vorerst
            überspringen und den Connector bereits starten.
          </p>
        );
      case 6:
        return (
          <div className="connector-stack">
            <p className="connector-muted">
              Suche nach laufenden Providern und lokalen Modellpfaden. Das Ergebnis landet im lokalen Model-Store.
            </p>
            <div className="connector-actions">
              <ButtonV2 variant="secondary" onClick={runModelScan} disabled={busy}>
                Modelle scannen
              </ButtonV2>
            </div>
            <div className="connector-stats-row">
              <div className="connector-stat-pill">Profile: {modelStore.profiles.length}</div>
              <div className="connector-stat-pill">Scan-Pfade: {modelStore.scanPaths.length}</div>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="connector-stack">
            {modelStore.profiles.length === 0 ? (
              <p className="connector-muted">
                Noch keine Modelle vorhanden. Du kannst den Schritt überspringen und später in P1 einen Scan ausführen.
              </p>
            ) : (
              <div className="connector-profile-list">
                {modelStore.profiles.slice(0, 5).map((profile) => (
                  <div key={profile.id} className="connector-inline-card">
                    <div className="connector-inline-card-header">
                      <div>
                        <p className="connector-lead">{profile.displayName || profile.name}</p>
                        <p className="connector-muted">
                          {profile.provider} · {profile.modelType}
                        </p>
                      </div>
                      <HealthBadge
                        status={profile.enabledForUwe ? "ok" : "degraded"}
                        label={profile.enabledForUwe ? "Freigegeben" : "Nicht freigegeben"}
                      />
                    </div>
                    {!profile.enabledForUwe ? (
                      <ButtonV2
                        variant="primary"
                        onClick={() => void enableProfileForUwe(profile.id)}
                        disabled={busy}
                      >
                        Für UWE aktivieren
                      </ButtonV2>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 8:
        return (
          <div className="connector-stack">
            <p className="connector-lead">Einrichtung abgeschlossen</p>
            <dl className="connector-kv">
              <div>
                <dt>Name</dt>
                <dd>{config.name}</dd>
              </div>
              <div>
                <dt>Host</dt>
                <dd>{config.hostUrl}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>{maskToken(config.token)}</dd>
              </div>
            </dl>
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.autoConnect}
                onChange={(event) => updateConfig("autoConnect", event.target.checked)}
              />
              <span>Connector nach dem Wizard automatisch starten</span>
            </label>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="connector-wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <CardV2
        title={`Erststart — Schritt ${step.id} von ${WIZARD_STEPS.length}`}
        className="connector-wizard-card"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="ghost" onClick={() => void handleDismiss()} disabled={busy}>
              Später
            </ButtonV2>
            {stepIndex > 0 ? (
              <ButtonV2 variant="secondary" onClick={() => setStepIndex((value) => value - 1)} disabled={busy}>
                Zurück
              </ButtonV2>
            ) : null}
            {isLastStep ? (
              <ButtonV2 variant="primary" onClick={finishWizard} disabled={busy}>
                Fertig
              </ButtonV2>
            ) : (
              <ButtonV2
                variant="primary"
                onClick={() => void goNext()}
                disabled={busy || !canAdvance}
              >
                Weiter
              </ButtonV2>
            )}
          </div>
        }
      >
        <div className="connector-stack">
          <p id="wizard-title" className="connector-lead">
            {step.title}
          </p>
          <p className="connector-muted">{step.description}</p>
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {renderStepBody()}
        </div>
      </CardV2>
    </div>
  );
}
