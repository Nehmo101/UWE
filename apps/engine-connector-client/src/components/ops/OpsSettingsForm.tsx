import { useCallback, useEffect, useMemo, useState } from "react";

import { opsInvoke } from "../../lib/tauri";
import { toMessage } from "../../lib/connector-runtime-labels";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import {
  SETTINGS_GROUPS,
  buildUpdateBody,
  coerceSettingValue,
  readSettingValue,
  type SettingsField,
} from "./settings-fields";

/**
 * Systemeinstellungen — der Ersatz für Studio `/settings` (Abschnitt D33).
 *
 * Nur geänderte Felder werden gesendet: `updateSettings` nimmt ein Teil-Objekt
 * entgegen, und ein Vollbild-Schreiben würde nebenher Werte überschreiben, die
 * eine andere Fläche gerade gesetzt hat. Was gesendet werden darf, entscheidet
 * `validateSettingsUpdate` auf dem Host — Fehler kommen hier als Text an.
 */

const ALL_FIELDS = SETTINGS_GROUPS.flatMap((group) => group.fields);
const FIELD_ID = (field: SettingsField): string => `${field.group}.${field.key}`;

function toFormValue(raw: unknown): string | boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

export function OpsSettingsForm() {
  const [settings, setSettings] = useState<unknown>(null);
  const [edits, setEdits] = useState<Map<string, string | boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fieldsById = useMemo(() => {
    const map = new Map<string, SettingsField>();
    for (const field of ALL_FIELDS) map.set(FIELD_ID(field), field);
    return map;
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await opsInvoke("settings-get");
      if (!result.ok) throw new Error(result.message ?? "Einstellungen nicht lesbar.");
      setSettings(result.data ?? null);
      setEdits(new Map());
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (edits.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const coerced = new Map<string, unknown>();
      for (const [id, raw] of edits) {
        const field = fieldsById.get(id);
        if (field) coerced.set(id, coerceSettingValue(field, raw));
      }
      const result = await opsInvoke("settings-update", buildUpdateBody(coerced, fieldsById));
      if (!result.ok) throw new Error(result.message ?? "Speichern fehlgeschlagen.");
      setSettings(result.data ?? null);
      setEdits(new Map());
      setMessage("Einstellungen gespeichert.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [edits, fieldsById]);

  const valueOf = (field: SettingsField): string | boolean => {
    const id = FIELD_ID(field);
    const edited = edits.get(id);
    if (edited !== undefined) return edited;
    return toFormValue(readSettingValue(settings, field));
  };

  const setValue = (field: SettingsField, value: string | boolean): void => {
    setMessage(null);
    setEdits((current) => new Map(current).set(FIELD_ID(field), value));
  };

  return (
    <div className="command-center-stack">
      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

      {SETTINGS_GROUPS.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="connector-muted">{group.description}</p>
            <div className="connector-form-grid">
              {group.fields.map((field) => {
                const value = valueOf(field);

                if (field.kind === "boolean") {
                  return (
                    <label key={FIELD_ID(field)} className="connector-checkbox">
                      <input
                        type="checkbox"
                        checked={value === true}
                        disabled={busy}
                        onChange={(event) => setValue(field, event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                if (field.kind === "select") {
                  return (
                    <label key={FIELD_ID(field)} className="connector-field">
                      <span>{field.label}</span>
                      <select
                        className="connector-input"
                        value={String(value)}
                        disabled={busy}
                        onChange={(event) => setValue(field, event.target.value)}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {field.hint ? <small>{field.hint}</small> : null}
                    </label>
                  );
                }

                if (field.kind === "textarea") {
                  return (
                    <label key={FIELD_ID(field)} className="connector-field connector-field-full">
                      <span>{field.label}</span>
                      <textarea
                        className="connector-input"
                        rows={5}
                        value={String(value)}
                        disabled={busy}
                        onChange={(event) => setValue(field, event.target.value)}
                      />
                      {field.hint ? <small>{field.hint}</small> : null}
                    </label>
                  );
                }

                return (
                  <label key={FIELD_ID(field)} className="connector-field">
                    <span>{field.label}</span>
                    <input
                      className="connector-input"
                      type={field.kind === "number" ? "number" : "text"}
                      min={field.min}
                      max={field.max}
                      value={String(value)}
                      disabled={busy}
                      onChange={(event) => setValue(field, event.target.value)}
                    />
                    {field.hint ? <small>{field.hint}</small> : null}
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
            <Button variant="primary" onClick={() => void save()} disabled={busy || edits.size === 0}>
              {busy ? "Wird gespeichert …" : `Speichern (${edits.size})`}
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={busy}>
              Verwerfen &amp; neu laden
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
