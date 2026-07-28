"use client";

import { useMemo, useState } from "react";
import {
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  extractTemplateVariables,
  renderDocumentTemplate,
  type DocumentTemplateCategoryKey,
} from "@uwe/shared-utils";

/**
 * Vorlage auswählen, Platzhalter füllen, Text herausholen.
 *
 * Bewusst ohne Speichern: das Ergebnis ist ein Brief oder eine Mail, kein
 * Datensatz. Die Vorschau rechnet im Browser — dieselbe Substitution wie
 * server-seitig, aus @uwe/shared-utils, damit beide nicht auseinanderlaufen.
 */

export interface FamilyTemplateDto {
  id: string;
  name: string;
  category: DocumentTemplateCategoryKey;
  body: string;
}

export function FamilyDocumentFiller({ templates }: { templates: FamilyTemplateDto[] }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const keys = useMemo(
    () => (selected ? extractTemplateVariables(selected.body) : []),
    [selected],
  );

  const filled = selected ? renderDocumentTemplate(selected.body, values) : "";
  const missing = keys.filter((key) => !values[key]?.trim());

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied("In die Zwischenablage kopiert.");
    } catch {
      setCopied("Kopieren hat nicht geklappt — Text markieren und Strg+C.");
    }
  }

  if (templates.length === 0) {
    return <p className="family-muted">Noch keine Vorlage — leg unten die erste an.</p>;
  }

  return (
    <div className="family-card family-form">
      <label>
        Vorlage
        <select
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setValues({});
            setCopied(null);
          }}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · {DOCUMENT_TEMPLATE_CATEGORY_LABELS[template.category]}
            </option>
          ))}
        </select>
      </label>

      {keys.length > 0 ? (
        <div className="family-form-row">
          {keys.map((key) => (
            <label key={key}>
              {key}
              <input
                value={values[key] ?? ""}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, [key]: event.target.value }));
                  setCopied(null);
                }}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="family-muted">Diese Vorlage hat keine Platzhalter.</p>
      )}

      <label>
        Ergebnis
        <textarea readOnly rows={10} value={filled} />
      </label>

      <div className="family-chat-actions">
        <button type="button" className="family-btn family-btn-sm" onClick={copy}>
          Text kopieren
        </button>
        {missing.length > 0 ? (
          <span className="family-tag family-tag-warn">Noch offen: {missing.join(", ")}</span>
        ) : null}
        {copied ? <span className="family-muted">{copied}</span> : null}
      </div>
    </div>
  );
}
