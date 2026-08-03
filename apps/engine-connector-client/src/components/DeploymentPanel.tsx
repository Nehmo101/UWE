import { useCallback, useEffect, useMemo, useState } from "react";

import { getHostEnv, setHostEnv, type HostEnvField, type HostEnvResult } from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

const BOOL_TRUE = new Set(["true", "1", "yes", "on"]);

export function DeploymentPanel() {
  const [data, setData] = useState<HostEnvResult | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await getHostEnv();
      setData(result);
      setValues({ ...result.values });
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, HostEnvField[]>();
    for (const field of data?.fields ?? []) {
      const list = byGroup.get(field.group) ?? [];
      list.push(field);
      byGroup.set(field.group, list);
    }
    return [...byGroup.entries()];
  }, [data]);

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await setHostEnv(values);
      if (!result.ok) throw new Error("Speichern fehlgeschlagen.");
      setMessage(
        `Gespeichert (${result.written.length} Einstellungen). Port-/URL-/Auth-Änderungen greifen nach „Reparieren / neu bauen" und einem Dienst-Neustart.`,
      );
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="command-center-stack">
      <section className="command-center-hero is-attention">
        <div>
          <span className="connector-kicker">DEPLOYMENT · PORTS · URLS · KI · MAIL</span>
          <h3>Deployment-Einstellungen</h3>
          <p>Bearbeite die zentrale Host-Konfiguration (`.env`) direkt hier — ohne die Datei von Hand zu editieren.</p>
        </div>
      </section>

      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

      {groups.map(([group, fields]) => (
        <Card key={group}>
          <CardHeader><CardTitle>{group}</CardTitle></CardHeader>
          <CardContent>
            <div className="connector-form-grid">
              {fields.map((field) => {
                const value = values[field.key] ?? "";
                if (field.kind === "boolean") {
                  return (
                    <label key={field.key} className="connector-checkbox">
                      <input
                        type="checkbox"
                        checked={BOOL_TRUE.has(value.trim().toLowerCase())}
                        onChange={(event) => setValue(field.key, event.target.checked ? "true" : "false")}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }
                const configured = data?.configured[field.key];
                return (
                  <label key={field.key} className="connector-field">
                    <span>{field.label}</span>
                    <input
                      className="connector-input"
                      type={field.kind === "password" ? "password" : field.kind === "number" ? "number" : "text"}
                      value={value}
                      onChange={(event) => setValue(field.key, event.target.value)}
                      placeholder={field.kind === "password" && configured ? "•••••• (gesetzt — leer lassen zum Behalten)" : ""}
                    />
                    {field.help ? <small>{field.help}</small> : null}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardFooter>
          <div className="connector-actions">
            <Button variant="primary" onClick={save} disabled={busy || !data}>
              {busy ? "Wird gespeichert …" : "Einstellungen speichern"}
            </Button>
            <Button variant="ghost" onClick={() => void refresh()} disabled={busy}>Zurücksetzen</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
