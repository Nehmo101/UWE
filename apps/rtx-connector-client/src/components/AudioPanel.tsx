import { useState } from "react";

import { ButtonV2, CardV2 } from "@uwe/shared-ui";
import type { ConnectorClientConfig } from "@uwe/connector-client-config";

import type { CommandTestResult } from "../lib/tauri";

type Props = {
  config: ConnectorClientConfig;
  busy: boolean;
  onChange: <K extends keyof ConnectorClientConfig>(key: K, value: ConnectorClientConfig[K]) => void;
  onSave: () => Promise<void>;
  onTest: (source?: string) => Promise<CommandTestResult>;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export function AudioPanel({ config, busy, onChange, onSave, onTest }: Props) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [source, setSource] = useState("");

  const disabled = busy || activeAction !== null;

  async function run(action: string, fn: () => Promise<void>) {
    setActiveAction(action);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSave() {
    await run("save", async () => {
      await onSave();
      setNotice("Audio-Kommando gespeichert.");
    });
  }

  async function handleTest() {
    await run("test", async () => {
      const result = await onTest(source.trim() || undefined);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
    });
  }

  return (
    <CardV2
      title="Lokale Audioausgabe"
      footer={
        <div className="connector-actions">
          <ButtonV2 variant="primary" onClick={handleSave} disabled={disabled}>
            Speichern
          </ButtonV2>
          <ButtonV2 variant="secondary" onClick={handleTest} disabled={disabled || !config.audioCommand}>
            Test abspielen
          </ButtonV2>
        </div>
      }
    >
      <div className="connector-stack">
        <p className="connector-muted">
          Befehl zum Abspielen von Soundboard-Sounds auf dem RTX-PC. Die Audioquelle (URL/Pfad)
          wird als letztes Argument angehängt — z. B. <code>mpv --no-video</code> oder{" "}
          <code>ffplay -nodisp -autoexit</code>. Aktiviert die Capability{" "}
          <code>audio_local</code>.
        </p>

        {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
        {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

        <label className="connector-field connector-field-full">
          <span>Audio-Kommando</span>
          <input
            className="connector-input"
            value={config.audioCommand}
            onChange={(event) => onChange("audioCommand", event.target.value)}
            placeholder="mpv --no-video"
          />
        </label>

        <label className="connector-field connector-field-full">
          <span>Test-Audioquelle (optional)</span>
          <input
            className="connector-input"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="https://… oder lokaler Pfad zu einer Audiodatei"
          />
        </label>
      </div>
    </CardV2>
  );
}
