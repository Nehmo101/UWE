import { useState } from "react";

import type { ConnectorClientConfig } from "@uwe/connector-client-config";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

type Props = {
  config: ConnectorClientConfig;
  busy: boolean;
  onChange: <K extends keyof ConnectorClientConfig>(key: K, value: ConnectorClientConfig[K]) => void;
  onSave: () => Promise<void>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  return "Unbekannter Fehler";
}

/**
 * Local speech-to-text command. Setting it here — rather than by hand on the
 * host — is what makes the Brain's dictation self-service: the connector picks
 * the value up as `UWE_CONNECTOR_STT_CMD` and starts advertising `stt_local`.
 */
export function SpeechPanel({ config, busy, onChange, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const disabled = busy || saving;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await onSave();
      setNotice(
        config.sttCommand.trim()
          ? "Sprach-Kommando gespeichert. Der Connector meldet jetzt stt_local."
          : "Sprach-Kommando geleert. Lokales Diktat ist damit deaktiviert.",
      );
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lokale Spracherkennung</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <p className="connector-muted">
            Befehl für lokales Diktat (whisper.cpp, faster-whisper …). Der Payload kommt als JSON
            auf <code>stdin</code> — <code>{"{audioPath, mimeType, language, model}"}</code> — und
            eine JSON-Antwort <code>{"{text, model}"}</code> wird als Transkript übernommen.
            Aktiviert die Capability <code>stt_local</code>, mit der der UWE-Brain-Chat diktieren
            kann. Leer lassen deaktiviert das lokale Diktat.
          </p>
          <p className="connector-muted">
            Fertiges Beispiel im Repo: <code>deploy/scripts/uwe-stt-whisper.sh</code>. Die Audiodatei
            verlässt den RTX-PC dabei nie.
          </p>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          <label className="connector-field connector-field-full">
            <span>Sprach-Kommando</span>
            <input
              className="connector-input"
              value={config.sttCommand}
              onChange={(event) => onChange("sttCommand", event.target.value)}
              placeholder="bash C:\git\UWE\deploy\scripts\uwe-stt-whisper.sh"
            />
          </label>
        </div>
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <Button variant="primary" onClick={handleSave} disabled={disabled}>
            Speichern
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
