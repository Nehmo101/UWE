import { useState } from "react";

import { ButtonV2, CardV2 } from "@uwe/shared-ui";
import type { ConnectorClientConfig } from "@uwe/connector-client-config";

import type { CommandTestResult } from "../lib/tauri";

type Props = {
  config: ConnectorClientConfig;
  busy: boolean;
  onChange: <K extends keyof ConnectorClientConfig>(key: K, value: ConnectorClientConfig[K]) => void;
  onSave: () => Promise<void>;
  onTest: (prompt?: string) => Promise<CommandTestResult>;
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

export function ImagePanel({ config, busy, onChange, onSave, onTest }: Props) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

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
      setNotice("Image-Kommando gespeichert.");
    });
  }

  async function handleTest() {
    await run("test", async () => {
      setOutput(null);
      const result = await onTest(prompt.trim() || undefined);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
      setOutput(result.output ?? null);
    });
  }

  return (
    <CardV2
      title="Lokale Bildgenerierung"
      footer={
        <div className="connector-actions">
          <ButtonV2 variant="primary" onClick={handleSave} disabled={disabled}>
            Speichern
          </ButtonV2>
          <ButtonV2 variant="secondary" onClick={handleTest} disabled={disabled || !config.imageCommand}>
            Test-Job starten
          </ButtonV2>
        </div>
      }
    >
      <div className="connector-stack">
        <p className="connector-muted">
          Befehl für lokale Bildgenerierung. Der Job-Payload wird als JSON auf <code>stdin</code>{" "}
          übergeben; die Ausgabe (JSON) wird als Ergebnis übernommen. Aktiviert die Capability{" "}
          <code>image_generation</code>.
        </p>

        {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
        {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

        <label className="connector-field connector-field-full">
          <span>Image-Kommando</span>
          <input
            className="connector-input"
            value={config.imageCommand}
            onChange={(event) => onChange("imageCommand", event.target.value)}
            placeholder="python tools/generate_image.py"
          />
        </label>

        <label className="connector-field connector-field-full">
          <span>Test-Prompt (optional)</span>
          <input
            className="connector-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder=" a wizard in a misty forest"
          />
        </label>

        {output ? (
          <label className="connector-field connector-field-full">
            <span>Letzte Ausgabe</span>
            <textarea className="connector-input" value={output} readOnly rows={4} />
          </label>
        ) : null}
      </div>
    </CardV2>
  );
}
