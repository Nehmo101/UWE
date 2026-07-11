import { useState } from "react";

import type { ConnectorClientConfig } from "@uwe/connector-client-config";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import type { CommandTestResult } from "../lib/tauri";

type Props = {
  config: ConnectorClientConfig;
  busy: boolean;
  onChange: <K extends keyof ConnectorClientConfig>(key: K, value: ConnectorClientConfig[K]) => void;
  onSave: () => Promise<void>;
  onTest: (source?: string) => Promise<CommandTestResult>;
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
    <Card>
      <CardHeader>
        <CardTitle>Lokale Audioausgabe</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <Button variant="primary" onClick={handleSave} disabled={disabled}>
            Speichern
          </Button>
          <Button variant="secondary" onClick={handleTest} disabled={disabled || !config.audioCommand}>
            Test abspielen
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
