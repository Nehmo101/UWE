import { useState } from "react";

import { parseConnectorClientConfig, type ConnectorClientConfig } from "@uwe/connector-client-config";
import { HealthBadge } from "@uwe/shared-ui";

import {
  createUser,
  getHostStatus,
  openHostTarget,
  setInstallSelection,
  setupHost,
  startHost,
  writeConfig,
  type LocalHostServiceId,
  type LocalHostStatus,
} from "../../lib/tauri";
import { toMessage } from "../../lib/connector-runtime-labels";
import { useHostActionProgress } from "../../lib/useHostActionProgress";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";

import { InstallAppPicker } from "./InstallAppPicker";
import { accessFor, databasesFor, findAppEntry } from "./install-catalog";

type WizardStep = "apps" | "owner" | "run" | "done";

const STEP_ORDER: WizardStep[] = ["apps", "owner", "run", "done"];

const STEP_TITLES: Record<WizardStep, { title: string; description: string }> = {
  apps: {
    title: "Was soll auf diesem Rechner laufen?",
    description:
      "Wähle die Bereiche aus. Danach richtet UWE Datenbanken, Konfiguration und Builds in einem Durchgang ein.",
  },
  owner: {
    title: "Dein Owner-Konto",
    description:
      "Das erste Konto bekommt die Häkchen für alle gewählten Bereiche und darf UWE verwalten. Du kannst es auch später im Command Center unter „Zugänge“ anlegen.",
  },
  run: {
    title: "Installation starten",
    description:
      "Ein Klick: Abhängigkeiten, Datenbanken, Migrationen und Produktions-Builds. Das dauert je nach Rechner einige Minuten.",
  },
  done: { title: "Fertig", description: "UWE ist eingerichtet." },
};

interface Props {
  config: ConnectorClientConfig;
  onConfigSaved: (config: ConnectorClientConfig) => void;
  /** Wizard erfolgreich beendet — Parent lädt Status und Config neu. */
  onCompleted: () => void;
  /** „Später“ — Overlay schließen, ohne etwas einzurichten. */
  onDismiss: () => void;
}

/**
 * Der Ersteinrichtungs-Assistent des UWE Command Centers.
 *
 * Er springt beim allerersten Start auf und macht aus „welche Bereiche will
 * ich?" eine vollständige lokale Installation: App-Auswahl schreiben,
 * Abhängigkeiten und Prisma-Clients installieren, **nur die gebrauchten**
 * Datenbanken migrieren, optional Demo-Inhalte einspielen, den lokalen
 * Maschinenraum registrieren, die gewählten Apps bauen — und zum Schluss das
 * Owner-Konto anlegen.
 *
 * Bewusst genau ein langer Aufruf (`setupHost`) statt vieler kleiner: der
 * Fortschritt kommt live aus der Host-Steuerung, und ein Abbruch mittendrin
 * hinterlässt keinen halb geschriebenen Zustand in der Oberfläche.
 */
export function InstallWizard({ config, onConfigSaved, onCompleted, onDismiss }: Props) {
  const [step, setStep] = useState<WizardStep>("apps");
  const [root, setRoot] = useState(config.localHostRoot);
  const [apps, setApps] = useState<LocalHostServiceId[]>([
    "studio",
    "portal",
    "brain",
    "family",
    "landing",
  ]);
  const [seedDemoContent, setSeedDemoContent] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [startAfterInstall, setStartAfterInstall] = useState(true);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<LocalHostStatus | null>(null);

  const { progress, reset: resetProgress } = useHostActionProgress();

  const stepIndex = STEP_ORDER.indexOf(step);
  const ownerRequested = Boolean(displayName.trim() || email.trim() || password);
  const ownerValid = Boolean(displayName.trim() && email.trim() && password.length >= 8);

  function canAdvance(): boolean {
    if (step === "apps") return apps.length > 0;
    if (step === "owner") return !ownerRequested || ownerValid;
    return true;
  }

  async function runInstall() {
    setBusy(true);
    setError(null);
    setWarning(null);
    resetProgress();

    const targetRoot = root.trim() || undefined;
    try {
      // 1. Projektordner merken, damit Status, Start und Update denselben
      //    Checkout benutzen wie die Einrichtung.
      setPhase("Einstellungen speichern");
      const savedConfig = await writeConfig(
        parseConnectorClientConfig({ ...config, localHostRoot: root.trim() }),
      );
      onConfigSaved(savedConfig);

      // 2. Auswahl festschreiben — die Einrichtung liest sie, statt sie als
      //    Argument zu bekommen. Damit sehen auch Status und „Reparieren“
      //    später denselben Umfang.
      setPhase("Auswahl übernehmen");
      await setInstallSelection({ apps, seedDemoContent }, targetRoot);

      // 3. Der lange Lauf. Fortschritt kommt über `host-action-progress`.
      setPhase("UWE einrichten");
      const setup = await setupHost(targetRoot);
      setStatus(setup.status);
      if (!setup.ok) {
        setError(setup.message);
        return;
      }

      // 4. Owner-Konto. Ein Fehler hier macht die Installation nicht kaputt —
      //    das Konto lässt sich unter „Zugänge“ nachtragen.
      if (ownerRequested) {
        setPhase("Owner-Konto anlegen");
        const created = await createUser({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          isOwner: true,
          ...accessFor(apps),
        });
        if (!created.ok) {
          setWarning(
            `UWE ist eingerichtet, aber das Owner-Konto wurde nicht angelegt: ${created.message ?? "unbekannter Fehler"}. Du kannst es unter „Zugänge“ nachholen.`,
          );
        }
      }

      if (startAfterInstall) {
        setPhase("Dienste starten");
        const started = await startHost(targetRoot);
        setStatus(started.status);
        if (!started.ok) {
          setWarning(
            `UWE ist eingerichtet, der Start meldet aber: ${started.message} Unter „Host-Logs“ steht der Grund.`,
          );
        }
      } else {
        setStatus(await getHostStatus(targetRoot));
      }

      // Erst jetzt „erledigt": ein Abbruch weiter oben lässt den Assistenten
      // beim nächsten Start wieder aufspringen, statt einen halb eingerichteten
      // Rechner stillschweigend zu akzeptieren.
      onConfigSaved(
        await writeConfig(
          parseConnectorClientConfig({
            ...config,
            localHostRoot: root.trim(),
            installWizardCompleted: true,
          }),
        ),
      );
      setStep("done");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setPhase(null);
      setBusy(false);
    }
  }

  /** „Später“: nicht wieder aufspringen, aber auch nichts einrichten. */
  async function postpone() {
    try {
      const saved = await writeConfig(
        parseConnectorClientConfig({ ...config, installWizardCompleted: true }),
      );
      onConfigSaved(saved);
    } catch {
      // Eine ungültige Teil-Konfiguration darf das Schließen nicht blockieren.
    }
    onDismiss();
  }

  function renderProgress() {
    if (!busy) return null;
    const determinate = progress != null && progress.total > 0;
    const percent = determinate
      ? Math.min(100, Math.round((progress.step / progress.total) * 100))
      : null;
    return (
      <div className="command-center-progress" role="status" aria-live="polite">
        <div className="command-center-progress-head">
          <span className="command-center-progress-title">{phase ?? "Installation läuft"}</span>
          <span className="command-center-progress-count">
            {determinate
              ? `Schritt ${progress.step} von ${progress.total} · ${percent}%`
              : "Bitte warten …"}
          </span>
        </div>
        <div
          className={`command-center-progress-track${determinate ? "" : " is-indeterminate"}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={determinate ? (percent ?? undefined) : undefined}
        >
          <div
            className="command-center-progress-fill"
            style={determinate ? { width: `${percent}%` } : undefined}
          />
        </div>
        {determinate ? (
          <small className="command-center-progress-phase">{progress.label}</small>
        ) : null}
      </div>
    );
  }

  function renderBody() {
    switch (step) {
      case "apps":
        return (
          <div className="connector-stack">
            <label className="connector-field connector-field-full">
              <span>UWE-Projektordner</span>
              <input
                className="connector-input"
                value={root}
                disabled={busy}
                onChange={(event) => setRoot(event.target.value)}
                placeholder="C:\git\UWE"
              />
              <small>
                Leer lassen, wenn das Command Center aus dem Projektordner heraus läuft — er wird
                dann selbst gefunden. Daten und Logs liegen immer außerhalb des Checkouts.
              </small>
            </label>
            <InstallAppPicker
              apps={apps}
              seedDemoContent={seedDemoContent}
              busy={busy}
              onChangeApps={setApps}
              onChangeSeed={setSeedDemoContent}
            />
          </div>
        );
      case "owner":
        return (
          <div className="connector-stack">
            <div className="connector-form-grid">
              <label className="connector-field">
                <span>Anzeigename</span>
                <input
                  className="connector-input"
                  value={displayName}
                  disabled={busy}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Lasse"
                />
              </label>
              <label className="connector-field">
                <span>E-Mail</span>
                <input
                  className="connector-input"
                  type="email"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="du@example.org"
                />
              </label>
              <label className="connector-field connector-field-full">
                <span>Passwort (mindestens 8 Zeichen)</span>
                <input
                  className="connector-input"
                  type="password"
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>
            {ownerRequested && !ownerValid ? (
              <div className="connector-banner connector-banner-error">
                Anzeigename, E-Mail und ein Passwort mit mindestens 8 Zeichen werden gebraucht.
              </div>
            ) : null}
            <p className="connector-muted">
              Das Konto bekommt die Häkchen:{" "}
              <strong>
                {apps
                  .map((app) => findAppEntry(app))
                  .filter((entry) => entry?.accessArea)
                  .map((entry) => entry!.label)
                  .join(" · ") || "keine"}
              </strong>
              . Alle Felder leer lassen überspringt diesen Schritt.
            </p>
          </div>
        );
      case "run":
        return (
          <div className="connector-stack">
            <dl className="connector-kv">
              <div>
                <dt>Bereiche</dt>
                <dd>{apps.map((app) => findAppEntry(app)?.label ?? app).join(" · ")}</dd>
              </div>
              <div>
                <dt>Datenbanken</dt>
                <dd>{databasesFor(apps).join(" · ")}</dd>
              </div>
              <div>
                <dt>Demo-Inhalte</dt>
                <dd>{seedDemoContent ? "werden eingespielt" : "keine"}</dd>
              </div>
              <div>
                <dt>Owner-Konto</dt>
                <dd>{ownerRequested ? email.trim() : "später unter „Zugänge“"}</dd>
              </div>
              <div>
                <dt>Projektordner</dt>
                <dd>{root.trim() || "wird automatisch gefunden"}</dd>
              </div>
            </dl>
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={startAfterInstall}
                disabled={busy}
                onChange={(event) => setStartAfterInstall(event.target.checked)}
              />
              <span>Nach der Installation direkt starten</span>
            </label>
            <p className="connector-muted">
              Es wird nichts ins Internet veröffentlicht. Alle Dienste hören zunächst nur lokal;
              öffentlich wird UWE erst über den Cloudflare-Tunnel.
            </p>
          </div>
        );
      case "done":
        return (
          <div className="connector-stack">
            <HealthBadge status="ok" label="Installation abgeschlossen" />
            <div className="connector-actions">
              {(status?.services ?? []).map((service) => (
                <Button
                  key={service.id}
                  variant="secondary"
                  onClick={() => void openHostTarget(root.trim() || undefined, service.id)}
                  disabled={!service.healthy}
                >
                  {service.label} öffnen
                </Button>
              ))}
            </div>
            <p className="connector-muted">
              Nächste Schritte: unter „Maschinenraum“ die lokale Rechenleistung verbinden, unter
              „Zugänge“ weitere Konten anlegen, unter „Cloudflare-Tunnel“ öffentlich schalten.
            </p>
          </div>
        );
      default:
        return null;
    }
  }

  const isRunStep = step === "run";
  const isDone = step === "done";

  return (
    <div
      className="connector-wizard-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-wizard-title"
    >
      <Card className="connector-wizard-card">
        <CardHeader>
          <CardTitle>
            {isDone
              ? "UWE ist startklar"
              : `Ersteinrichtung — Schritt ${stepIndex + 1} von ${STEP_ORDER.length - 1}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="connector-stack">
            <p id="install-wizard-title" className="connector-lead">
              {STEP_TITLES[step].title}
            </p>
            <p className="connector-muted">{STEP_TITLES[step].description}</p>
            {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
            {warning ? (
              <div className="connector-banner connector-banner-warning">{warning}</div>
            ) : null}
            {renderProgress()}
            {renderBody()}
          </div>
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            {isDone ? (
              <Button variant="primary" onClick={onCompleted}>
                Zum Command Center
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => void postpone()} disabled={busy}>
                  Später
                </Button>
                {stepIndex > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
                    disabled={busy}
                  >
                    Zurück
                  </Button>
                ) : null}
                {isRunStep ? (
                  <Button variant="accent" onClick={() => void runInstall()} disabled={busy}>
                    {busy ? "Installation läuft …" : "Jetzt installieren"}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setStep(STEP_ORDER[stepIndex + 1])}
                    disabled={busy || !canAdvance()}
                  >
                    Weiter
                  </Button>
                )}
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
