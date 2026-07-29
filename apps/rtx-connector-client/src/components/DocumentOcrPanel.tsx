import { useMemo, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

import type { PullOllamaModelResult } from "../lib/tauri";
import { useOllamaPullProgress } from "../lib/useOllamaPullProgress";

/**
 * Einrichtung des Dokumenten-OCR-Modells. UWE nutzt Unlimited-OCR für den
 * PDF→Kampagne-Import und die Scan-Inbox; ohne das Modell fällt beides auf
 * den reinen Textlayer zurück (Scans scheitern, Layout geht verloren).
 *
 * Die Karte führt durch genau drei Schritte und zeigt jeweils, ob der Schritt
 * schon erledigt ist — statt den Nutzer den Pull-Befehl aus der Doku suchen zu
 * lassen.
 */

/** Ollama-Tag, den UWE als Vorgabe erwartet (`UNLIMITED_OCR_MODEL`). */
const OCR_MODEL = "frob/unlimited-ocr:q8_0";

const PULL_COMMAND = `ollama pull ${OCR_MODEL}`;

/** Erkennt Unlimited-OCR an beliebigen Tags/Forks — spiegelt `isUnlimitedOcrModel`. */
function isOcrModel(name: string): boolean {
  return /unlimited[-_]?ocr/i.test(name);
}

type Props = {
  store: ConnectorModelProfileStore;
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

type StepState = "done" | "todo";

function StepRow({
  state,
  title,
  children,
}: {
  state: StepState;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="connector-inline-card">
      <div className="connector-inline-card-header">
        <p className="connector-lead">{title}</p>
        <HealthBadge
          status={state === "done" ? "ok" : "degraded"}
          label={state === "done" ? "Erledigt" : "Offen"}
        />
      </div>
      {children}
    </div>
  );
}

export function DocumentOcrPanel({ store, onPullModel, onEnableForUwe }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { progress, reset: resetProgress } = useOllamaPullProgress();

  const installed = useMemo(
    () => store.profiles.find((profile) => isOcrModel(profile.name)) ?? null,
    [store.profiles],
  );
  const enabled = installed?.enabledForUwe === true;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(PULL_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }

  async function runPull() {
    setBusy("pull");
    setError(null);
    setNotice(null);
    resetProgress();
    try {
      await onPullModel(OCR_MODEL);
      setNotice(`„${OCR_MODEL}“ geladen.`);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function runEnable() {
    const name = installed?.name ?? OCR_MODEL;
    setBusy("enable");
    setError(null);
    setNotice(null);
    try {
      await onEnableForUwe(name);
      setNotice(`„${name}“ ist für UWE aktiv.`);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumenten-OCR einrichten</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <p className="connector-muted">
            UWE liest PDFs mit <strong>Unlimited-OCR</strong> (Baidu, MIT) — layout-treu, mit
            Tabellen und Bildboxen. Gebraucht für <em>PDF → Kampagne</em> im Studio und die
            Scan-Inbox in Family. Ohne das Modell bleibt nur der reine Textlayer: gescannte
            Abenteuerbände scheitern, mehrspaltige Seiten verlieren ihre Lesereihenfolge.
          </p>

          <div className="connector-stats-row">
            <div className="connector-stat-pill">~4 GB Download</div>
            <div className="connector-stat-pill">≈5 GB VRAM</div>
            <div className="connector-stat-pill">32K Kontext</div>
            <div className="connector-stat-pill">MIT-Lizenz</div>
          </div>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? (
            <div className="connector-banner connector-banner-success">{notice}</div>
          ) : null}

          <StepRow state={installed ? "done" : "todo"} title="1 · Modell laden">
            <p className="connector-muted">
              {installed
                ? `Gefunden: ${installed.name}`
                : "Noch nicht auf diesem Rechner. Der Knopf führt genau diesen Befehl aus:"}
            </p>
            <pre className="connector-code">{PULL_COMMAND}</pre>
            <div className="connector-actions">
              <Button variant="ghost" onClick={() => void copyCommand()} disabled={busy !== null}>
                {copied ? "Kopiert" : "Befehl kopieren"}
              </Button>
              <Button variant="primary" onClick={() => void runPull()} disabled={busy !== null}>
                {busy === "pull" ? "Lädt …" : installed ? "Erneut laden" : "Jetzt laden"}
              </Button>
            </div>
            {busy === "pull" && progress ? (
              <div className="connector-stack">
                <p className="connector-muted">
                  {progress.status || "…"}
                  {typeof progress.fraction === "number"
                    ? ` (${Math.round(progress.fraction * 100)} %)`
                    : ""}
                </p>
                <progress
                  className="connector-progress"
                  value={progress.fraction ?? undefined}
                  max={1}
                />
              </div>
            ) : null}
          </StepRow>

          <StepRow state={enabled ? "done" : "todo"} title="2 · Für UWE freigeben">
            <p className="connector-muted">
              Erst freigegebene Modelle meldet der Connector als Fähigkeit{" "}
              <code>vision_local</code> an den Host — nur dann kann UWE OCR-Aufträge schicken.
            </p>
            <div className="connector-actions">
              <Button
                variant={enabled ? "ghost" : "primary"}
                onClick={() => void runEnable()}
                disabled={busy !== null || enabled}
              >
                {busy === "enable" ? "Aktiviert …" : enabled ? "Bereits aktiv" : "Für UWE aktivieren"}
              </Button>
            </div>
          </StepRow>

          <StepRow state="todo" title="3 · Im Studio als Vision-Modell wählen">
            <p className="connector-muted">
              Studio → System → RTX Connector → Workflow-Modelle: Slot <code>Vision</code> auf
              dieses Modell setzen. Ohne gesetzten Slot nimmt UWE ohnehin Unlimited-OCR als
              Vorgabe — die Wahl ist nur nötig, wenn dort ein anderes Modell steht.
            </p>
          </StepRow>

          <p className="connector-muted">
            Voraussetzung: Ollama auf llama.cpp ≥ Build 168 (01.07.2026). Ältere Versionen kennen
            die Architektur nicht und brechen den Ladevorgang ab.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <span className="connector-muted">
            {installed && enabled
              ? "Dokumenten-OCR ist einsatzbereit."
              : "Schritte 1 und 2 fehlen noch — bis dahin liest UWE nur Textlayer."}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
