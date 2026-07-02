"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type {
  GeneratorActionDefinition,
  StructuredGeneratorSchema,
} from "@uwe/database/generator-types";
import {
  EquipmentSearchBox,
  equipmentKindLabel,
  type EquipmentSearchResult,
} from "@/components/wiki/EquipmentSearchBox";

export interface MagicItemPresetOption {
  id: string;
  name: string;
  description: string;
  fieldIds: string[];
  defaults: Record<string, string>;
}

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  schema: StructuredGeneratorSchema;
  action: GeneratorActionDefinition;
  presets: MagicItemPresetOption[];
  searchEquipmentUrl: string;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

function formatSrdBase(result: EquipmentSearchResult): string {
  const label = equipmentKindLabel(result.kind);
  const source = result.provider === "open5e" ? "Open5e (CC-BY)" : "5e SRD";
  const head = [result.name, label ? `(${label})` : null].filter(Boolean).join(" ");
  const summary = result.summary ? ` — ${result.summary}` : "";
  const url = result.url ? `, ${result.url}` : "";
  return `${head}${summary} [Quelle: ${source}${url}]`;
}

export function MagicItemBuilderPanel({
  worldSlug,
  pageSlug,
  pageTitle,
  schema,
  action,
  presets,
  searchEquipmentUrl,
  rtxReady,
  rtxEnabled,
}: Props) {
  const [presetId, setPresetId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const activePreset = presets.find((preset) => preset.id === presetId) ?? null;
  const visibleFields = activePreset
    ? schema.fields.filter(
        (field) =>
          field.required ||
          activePreset.fieldIds.includes(field.id) ||
          (field.id === "srdBase" && Boolean(values.srdBase?.trim())),
      )
    : schema.fields;

  function selectPreset(nextId: string) {
    setPresetId(nextId);
    const preset = presets.find((entry) => entry.id === nextId);
    if (!preset) {
      return;
    }
    setValues((current) => {
      const next = { ...current };
      for (const [fieldId, value] of Object.entries(preset.defaults)) {
        if (!next[fieldId]?.trim()) {
          next[fieldId] = value;
        }
      }
      return next;
    });
  }

  function applyEquipment(result: EquipmentSearchResult) {
    setValues((current) => ({ ...current, srdBase: formatSrdBase(result) }));
    setStatus(`SRD-Basis übernommen: ${result.name}`);
  }

  async function runItemGenerator() {
    setBusy(true);
    setStatus(null);
    setJobId(null);

    try {
      const structuredInput = Object.fromEntries(
        visibleFields
          .map((field) => [field.id, values[field.id] ?? ""] as const)
          .filter(([, value]) => value.trim().length > 0),
      );

      const response = await fetch(studioApiUrl("/api/ai/generator"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.id,
          worldSlug,
          pageSlug,
          structuredInput,
          ...(presetId ? { presetId } : {}),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        deferred?: boolean;
        jobId?: string;
        job?: { id: string };
        runId?: string;
      };

      if (!response.ok) {
        setStatus(payload.error ?? "Item-Generierung fehlgeschlagen.");
        return;
      }

      if (response.status === 202 || payload.deferred) {
        const id = payload.jobId ?? payload.job?.id ?? null;
        setJobId(id);
        setStatus(payload.message ?? "RTX offline — Job vorgemerkt. Kein Cloud-Fallback.");
        return;
      }

      if (payload.runId) {
        setStatus("Item-Vorschlag erstellt — Review unter AI Runs (keine automatische Übernahme).");
        return;
      }

      setStatus("Aktion abgeschlossen.");
    } catch {
      setStatus("Netzwerkfehler bei der Generierung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Magic-Item-Builder (strukturiert)</h2>
      <p className="uwe-dashboard-muted">
        Template wählen, SRD/Open5e-Gegenstand als Basis übernehmen und Seltenheit,
        Einstimmung &amp; Eigenschaften für {pageTitle} generieren — RTX-only, Ergebnis
        läuft als Review-Vorschlag (nie automatisch übernehmen).
      </p>

      {!rtxEnabled && (
        <p className="uwe-form-error" role="alert">
          RTX-Inference ist deaktiviert.
        </p>
      )}

      {rtxEnabled && !rtxReady && (
        <p className="uwe-hint">RTX offline — wird als Job vorgemerkt (kein Cloud-Fallback).</p>
      )}

      <label>
        Template (GeneratorPreset)
        <select value={presetId} onChange={(event) => selectPreset(event.target.value)}>
          <option value="">Alle Felder (Standard)</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
              {preset.description ? ` — ${preset.description}` : null}
            </option>
          ))}
        </select>
      </label>

      <EquipmentSearchBox
        searchEquipmentUrl={searchEquipmentUrl}
        label="SRD / Open5e Basisgegenstand"
        renderResult={(result) => {
          const label = equipmentKindLabel(result.kind);
          return (
            <button
              type="button"
              className="auth-btn auth-btn-small"
              onClick={() => applyEquipment(result)}
            >
              {result.name}
              {label ? ` · ${label}` : null}
              {result.summary ? ` — ${result.summary}` : null}
            </button>
          );
        }}
      />
      <p className="uwe-hint">
        Open5e-Inhalte sind CC-BY — SRD/Open5e-Attribution bei Veröffentlichung beachten.
      </p>

      <form
        className="uwe-v2-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runItemGenerator();
        }}
      >
        {visibleFields.map((field) => (
          <label key={field.id}>
            {field.label}
            {field.required ? " *" : null}
            {field.kind === "textarea" ? (
              <textarea
                rows={3}
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
            ) : (
              <input
                type="text"
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
            )}
          </label>
        ))}

        <button
          type="submit"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!rtxEnabled || busy}
        >
          {busy ? "Läuft…" : action.label}
        </button>
      </form>

      {status && <p className="uwe-hint">{status}</p>}
      {jobId && (
        <p>
          <Link href="/jobs">Job {jobId.slice(0, 8)}… anzeigen →</Link>
        </p>
      )}
      <p className="uwe-dashboard-muted">
        <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs & Review →</Link>
      </p>
    </section>
  );
}
