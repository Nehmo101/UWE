"use client";

import { useMemo, useState } from "react";
import {
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  extractTemplateVariables,
  normalizeTemplateVariables,
  renderDocumentTemplate,
  type DocumentTemplateCategoryKey,
} from "@/src/lib/document-template-utils";

export type DocumentTemplateDto = {
  id: string;
  name: string;
  category: DocumentTemplateCategoryKey;
  body: string;
  variables: string[];
};

interface DocumentGeneratorPanelProps {
  templates: DocumentTemplateDto[];
}

export function DocumentGeneratorPanel({ templates }: DocumentGeneratorPanelProps) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const variableKeys = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }
    const fromBody = extractTemplateVariables(selectedTemplate.body);
    const fromDb = normalizeTemplateVariables(selectedTemplate.variables);
    return Array.from(new Set([...fromDb, ...fromBody])).sort();
  }, [selectedTemplate]);

  const rendered = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }
    return renderDocumentTemplate(selectedTemplate.body, values);
  }, [selectedTemplate, values]);

  function handleTemplateChange(nextId: string) {
    setSelectedId(nextId);
    setValues({});
    setStatus(null);
  }

  function handleValueChange(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function copyRendered() {
    if (!rendered.trim()) {
      setStatus("Kein Inhalt zum Kopieren.");
      return;
    }
    try {
      await navigator.clipboard.writeText(rendered);
      setStatus("Dokument in Zwischenablage kopiert.");
    } catch {
      setStatus("Kopieren fehlgeschlagen.");
    }
  }

  if (templates.length === 0) {
    return (
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Dokument erzeugen</h2>
        <p className="uwe-dashboard-muted">
          Lege zuerst eine Vorlage an, um Variablen auszufüllen und Text zu erzeugen.
        </p>
      </section>
    );
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Dokument erzeugen</h2>
      <p className="uwe-dashboard-muted">
        Vorlage wählen, Platzhalter ausfüllen, Vorschau prüfen und Ergebnis kopieren.
      </p>

      <label>
        Vorlage
        <select
          value={selectedId}
          onChange={(event) => handleTemplateChange(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({DOCUMENT_TEMPLATE_CATEGORY_LABELS[template.category]})
            </option>
          ))}
        </select>
      </label>

      {selectedTemplate ? (
        <p className="uwe-dashboard-muted">
          Kategorie: {DOCUMENT_TEMPLATE_CATEGORY_LABELS[selectedTemplate.category]}
        </p>
      ) : null}

      {variableKeys.length > 0 ? (
        <div className="uwe-brain-create-form">
          {variableKeys.map((key) => (
            <label key={key}>
              {key}
              <input
                value={values[key] ?? ""}
                onChange={(event) => handleValueChange(key, event.target.value)}
                placeholder={`{{${key}}}`}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="uwe-dashboard-muted">Diese Vorlage enthält keine Platzhalter.</p>
      )}

      <label>
        Vorschau
        <textarea rows={12} readOnly value={rendered} spellCheck={false} />
      </label>

      <div className="uwe-brain-create-form">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
          onClick={() => void copyRendered()}
        >
          In Zwischenablage kopieren
        </button>
      </div>

      {status ? <p className="uwe-dashboard-muted">{status}</p> : null}
    </section>
  );
}
