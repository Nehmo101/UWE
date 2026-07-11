"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { generateDocumentFromTemplateAction } from "@/app/document-actions";
import {
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  extractTemplateVariables,
  normalizeTemplateVariables,
  renderDocumentTemplate,
  type DocumentTemplateCategoryKey,
} from "@/src/lib/document-template-utils";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

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

interface SavedDocument {
  id: string;
  title: string;
}

/** TODO(design-kit): Native select bleibt — kontrolliertes Formularfeld (value+onChange),
    siehe gleiches Muster in JobsWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function DocumentGeneratorPanel({ templates }: DocumentGeneratorPanelProps) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [savedDocument, setSavedDocument] = useState<SavedDocument | null>(null);
  const [isSaving, startSaving] = useTransition();

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

  const missingKeys = useMemo(
    () => variableKeys.filter((key) => !(values[key] ?? "").trim()),
    [values, variableKeys],
  );

  const rendered = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }
    return renderDocumentTemplate(selectedTemplate.body, values);
  }, [selectedTemplate, values]);

  function handleTemplateChange(nextId: string) {
    setSelectedId(nextId);
    setValues({});
    setTitle("");
    setStatus(null);
    setSavedDocument(null);
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

  function saveDocument() {
    if (!selectedTemplate) {
      return;
    }
    if (missingKeys.length > 0) {
      setStatus(
        `Pflichtfelder fehlen: ${missingKeys.map((key) => `{{${key}}}`).join(", ")}`,
      );
      return;
    }

    startSaving(async () => {
      const result = await generateDocumentFromTemplateAction({
        templateId: selectedTemplate.id,
        title: title.trim() || undefined,
        values,
      });

      if (result.ok) {
        setSavedDocument({ id: result.documentId, title: result.title });
        setStatus(`Dokument „${result.title}“ gespeichert.`);
      } else {
        setSavedDocument(null);
        setStatus(result.error);
      }
    });
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dokument erzeugen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Lege zuerst eine Vorlage an, um Variablen auszufüllen und Text zu erzeugen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokument erzeugen</CardTitle>
        <CardDescription>
          Vorlage wählen, Platzhalter ausfüllen, Vorschau prüfen — dann speichern
          (Life Brain), drucken oder kopieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-generator-template">Vorlage</Label>
          <select
            id="document-generator-template"
            value={selectedId}
            onChange={(event) => handleTemplateChange(event.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({DOCUMENT_TEMPLATE_CATEGORY_LABELS[template.category]})
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate ? (
          <p className="text-sm text-muted-foreground">
            Kategorie: {DOCUMENT_TEMPLATE_CATEGORY_LABELS[selectedTemplate.category]}
          </p>
        ) : null}

        {variableKeys.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {variableKeys.map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`document-generator-var-${key}`}>{key} *</Label>
                <Input
                  id={`document-generator-var-${key}`}
                  value={values[key] ?? ""}
                  onChange={(event) => handleValueChange(key, event.target.value)}
                  placeholder={`{{${key}}}`}
                  required
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Diese Vorlage enthält keine Platzhalter.</p>
        )}

        {missingKeys.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Alle Platzhalter sind Pflichtfelder — noch offen:{" "}
            {missingKeys.map((key) => `{{${key}}}`).join(", ")}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-generator-title">Titel des Dokuments (optional)</Label>
          <Input
            id="document-generator-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              selectedTemplate ? `${selectedTemplate.name} — ${new Date().toISOString().slice(0, 10)}` : ""
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-generator-preview">Vorschau</Label>
          <Textarea id="document-generator-preview" rows={12} readOnly value={rendered} spellCheck={false} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={saveDocument}
            disabled={isSaving || missingKeys.length > 0}
          >
            {isSaving ? "Speichert …" : "Dokument speichern"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyRendered()}>
            In Zwischenablage kopieren
          </Button>
        </div>

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

        {savedDocument ? (
          <p>
            <Link href={`/life-brain/documents/${savedDocument.id}`}>
              Im Life Brain öffnen
            </Link>{" "}
            ·{" "}
            <a
              href={`/api/documents/print?documentId=${encodeURIComponent(savedDocument.id)}`}
              target="_blank"
              rel="noreferrer"
            >
              Druckansicht öffnen
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
