import { useMemo, useState } from "react";

import {
  maskToken,
  parseConnectorClientConfig,
  validateHostUrl,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
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
  onCompleted: (config: ConnectorClientConfig) => void;
  onDismiss: () => void;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export function SetupWizard({ initialConfig, onCompleted, onDismiss }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [config, setConfig] = useState<ConnectorClientConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HostConnectionTestResult | null>(null);

  const step = WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const canAdvance = useMemo(() => {
    switch (step.id) {
      case 1:
        return validateHostUrl(config.hostUrl).ok;
      case 2:
        return config.token.trim().length > 0;
      case 3:
        return config.name.trim().length > 0;
      case 4:
        return testResult?.ok === true;
      default:
        return true;
    }
  }, [config.hostUrl, config.name, config.token, step.id, testResult?.ok]);

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

    try {
      const result = await testHostConnection(config.hostUrl, config.token);
      setTestResult(result);
      if (!result.ok) {
        setError(result.message);
      }
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function finishWizard() {
    setBusy(true);
    setError(null);

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
          </div>
        );
      case 5:
      case 6:
      case 7:
        return (
          <p className="connector-muted">
            Dieser Schritt wird in einer späteren Phase automatisiert. Du kannst ihn vorerst
            überspringen und den Connector bereits starten.
          </p>
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
            <ButtonV2 variant="ghost" onClick={onDismiss} disabled={busy}>
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
                onClick={() => setStepIndex((value) => value + 1)}
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
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {renderStepBody()}
        </div>
      </CardV2>
    </div>
  );
}
