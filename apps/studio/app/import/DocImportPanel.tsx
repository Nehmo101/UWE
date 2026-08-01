"use client";

import { useCallback, useMemo, useState } from "react";
import type { DocImportPreview, DocImportSourceFile, DocProfile } from "@uwe/doc-import";
import { DOC_PROFILES, DOC_PROFILE_HINTS, DOC_PROFILE_LABELS } from "@uwe/doc-import";
import { arrayBufferToBase64 } from "@/src/lib/file-base64";
import {
  executeImportDocJobAction,
  extractDocImportVaultAction,
  previewImportDocJobAction,
} from "../import-doc-actions";
import {
  DOC_IMPORT_MODES,
  DOC_IMPORT_MODE_HINTS,
  DOC_IMPORT_MODE_LABELS,
  MAX_DOC_IMPORT_DEPTH,
  MIN_DOC_IMPORT_DEPTH,
  type DocImportSettings,
} from "@/src/lib/doc-import-settings";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/src/components/ui";
import { DocImportPreviewTree } from "./DocImportPreviewTree";

interface Props {
  jobId: string;
  isObsidianSource: boolean;
  fileAccept: string;
  onComplete?: () => void;
}

const DIRECTORY_INPUT_PROPS = {
  webkitdirectory: "",
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;

function relativeFileName(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative?.trim() ? relative : file.name;
}

function isMarkdownLikeFile(file: File): boolean {
  const name = relativeFileName(file).replace(/\\/g, "/");
  if (name.split("/").some((segment) => segment.startsWith("."))) return false;
  const lower = name.toLocaleLowerCase("de");
  return lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt");
}

export function DocImportPanel({ jobId, isObsidianSource, fileAccept, onComplete }: Props) {
  const [files, setFiles] = useState<DocImportSourceFile[]>([]);
  const [settings, setSettings] = useState<DocImportSettings>({
    mode: "wiki_pages",
    profile: "plain",
    maxDepth: 3,
  });
  const [preview, setPreview] = useState<DocImportPreview | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDocumentMode = settings.mode === "document";

  const resetPreview = useCallback(() => {
    setPreview(null);
    setSelectedKeys(new Set());
    setResultSummary(null);
    setUndoToken(null);
    setError(null);
  }, []);

  const handleFiles = useCallback(
    async (picked: File[]) => {
      if (picked.length === 0) return;
      resetPreview();

      const zipFile =
        picked.length === 1 && picked[0]!.name.toLocaleLowerCase("de").endsWith(".zip")
          ? picked[0]!
          : null;

      try {
        if (zipFile) {
          if (!isObsidianSource) {
            setError("ZIP-Dateien werden nur für die Obsidian-Quelle unterstützt.");
            return;
          }
          const base64 = arrayBufferToBase64(await zipFile.arrayBuffer());
          const { files: vaultFiles } = await extractDocImportVaultAction(base64);
          setFiles(vaultFiles);
          return;
        }

        const textFiles = picked.filter(isMarkdownLikeFile);
        if (textFiles.length === 0) {
          setError("Keine Markdown-Dateien in der Auswahl gefunden (.md, .markdown, .txt).");
          return;
        }

        setFiles(
          await Promise.all(
            textFiles.map(async (file) => ({
              fileName: relativeFileName(file),
              content: await file.text(),
            })),
          ),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Dateien konnten nicht gelesen werden.");
      }
    },
    [isObsidianSource, resetPreview],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void handleFiles([...(event.target.files ?? [])]);
    },
    [handleFiles],
  );

  const updateSettings = useCallback(
    (patch: Partial<DocImportSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
      resetPreview();
    },
    [resetPreview],
  );

  const handlePreview = useCallback(async () => {
    if (files.length === 0) {
      setError("Bitte zuerst Dateien auswählen.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await previewImportDocJobAction(jobId, files, settings);
      setPreview(response.preview);
      setSelectedKeys(new Set(response.preview.items.map((item) => item.key)));
      setResultSummary(null);
      setUndoToken(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [files, jobId, settings]);

  const handleExecute = useCallback(async () => {
    if (!preview || selectedKeys.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await executeImportDocJobAction(jobId, files, [...selectedKeys]);
      setResultSummary(response.resultSummary);
      setUndoToken(response.undoToken);
      onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [files, jobId, onComplete, preview, selectedKeys]);

  const fileSummary = useMemo(() => {
    if (files.length === 0) return "Keine Datei ausgewählt";
    if (files.length === 1) return files[0]!.fileName;
    return `${files.length} Dateien`;
  }, [files]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Dateien wählen</CardTitle>
          <CardDescription>
            Einzelne Dateien, ein ganzer Ordner
            {isObsidianSource ? " oder ein Vault-Export als ZIP" : ""}. Markdown, Text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="doc-import-files">Dateien</Label>
              <input
                id="doc-import-files"
                type="file"
                multiple
                accept={fileAccept}
                onChange={handleFileChange}
                className="block text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-import-dir">Ordner</Label>
              <input
                id="doc-import-dir"
                type="file"
                multiple
                onChange={handleFileChange}
                className="block text-sm"
                {...DIRECTORY_INPUT_PROPS}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{fileSummary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Wie soll das ankommen?</CardTitle>
          <CardDescription>{DOC_IMPORT_MODE_HINTS[settings.mode]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DOC_IMPORT_MODES.map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={settings.mode === mode ? "default" : "outline"}
                onClick={() => updateSettings({ mode })}
              >
                {DOC_IMPORT_MODE_LABELS[mode]}
              </Button>
            ))}
          </div>

          {isDocumentMode ? (
            <>
              <div className="space-y-2">
                <Label>Typ-Profil</Label>
                <div className="flex flex-wrap gap-2">
                  {DOC_PROFILES.map((profile: DocProfile) => (
                    <Button
                      key={profile}
                      type="button"
                      variant={settings.profile === profile ? "default" : "outline"}
                      onClick={() => updateSettings({ profile })}
                    >
                      {DOC_PROFILE_LABELS[profile]}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {DOC_PROFILE_HINTS[settings.profile]}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-import-depth">
                  Bis Überschriftenebene {settings.maxDepth} aufteilen
                </Label>
                <input
                  id="doc-import-depth"
                  type="range"
                  min={MIN_DOC_IMPORT_DEPTH}
                  max={MAX_DOC_IMPORT_DEPTH}
                  value={settings.maxDepth}
                  onChange={(event) =>
                    updateSettings({ maxDepth: Number.parseInt(event.target.value, 10) })
                  }
                  className="w-full max-w-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Tiefere Überschriften bleiben als Text in der Seite darüber stehen.
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handlePreview} disabled={loading || files.length === 0}>
          {loading && !preview ? "Wird gelesen…" : "Vorschau"}
        </Button>
        {preview ? (
          <Button
            type="button"
            onClick={handleExecute}
            disabled={loading || selectedKeys.size === 0 || resultSummary !== null}
          >
            {selectedKeys.size} Seite(n) anlegen
          </Button>
        ) : null}
      </div>

      {preview ? (
        <DocImportPreviewTree
          preview={preview}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          disabled={loading || resultSummary !== null}
        />
      ) : null}

      {resultSummary ? (
        <Alert tone="success">
          {String(resultSummary.created ?? 0)} Seite(n) angelegt,{" "}
          {String(resultSummary.linksCreated ?? 0)} Beziehung(en) verknüpft.
          {undoToken ? " Rückgängig über das Aktivitätsprotokoll." : ""}
        </Alert>
      ) : null}
    </div>
  );
}
