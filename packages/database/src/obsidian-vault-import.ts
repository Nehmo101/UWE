import {
  extractSafeZipEntries,
  ZipSecurityError,
  type SafeZipEntry,
  type ZipImportPolicy,
} from "@uwe/assets";

/**
 * Obsidian-Vault-Import — packt einen Vault-Export (ZIP) sicher aus und baut
 * daraus ein kombiniertes Markdown-Bundle für die bestehende
 * Import-Zentrale-Pipeline (previewMarkdownImport / executeMarkdownImport).
 *
 * Es werden nur Markdown-/Text-Dateien übernommen; Vault-Interna wie
 * `.obsidian/` (Plugins, Workspace-Konfiguration) und `.trash/` werden
 * übersprungen. ZIP-Slip-, Bomb- und Content-Guards kommen aus @uwe/assets.
 */

const MAX_VAULT_ZIP_BYTES = 10 * 1024 * 1024;
const MAX_VAULT_MARKDOWN_BYTES = 10 * 1024 * 1024;
const MAX_VAULT_FILES = 2000;

const VAULT_ZIP_POLICY: ZipImportPolicy = {
  maxZipBytes: MAX_VAULT_ZIP_BYTES,
  maxUncompressedBytes: MAX_VAULT_MARKDOWN_BYTES,
  maxFiles: MAX_VAULT_FILES,
};

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".txt"];

export class ObsidianVaultImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObsidianVaultImportError";
  }
}

export interface ObsidianVaultExtractResult {
  /** Combined markdown bundle (one frontmatter document per vault file). */
  markdown: string;
  /** Number of markdown files included in the bundle. */
  fileCount: number;
  /** Vault-relative paths of the included files (sorted). */
  files: string[];
}

export interface ObsidianVaultFile {
  /** Vault-relative path, forward slashes. */
  fileName: string;
  /** Raw file content, unchanged. */
  content: string;
}

/** Vault-Markdown-Datei? Versteckte Ordner (.obsidian, .trash, …) werden übersprungen. */
export function isObsidianVaultMarkdownEntry(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment.startsWith("."))) return false;

  const lower = normalized.toLocaleLowerCase("en");
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function titleFromVaultPath(entryName: string): string {
  const normalized = entryName.replace(/\\/g, "/");
  const baseName = normalized.split("/").pop() ?? normalized;
  return baseName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Import";
}

function buildMarkdownDocumentFromVaultFile(entryName: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("---")) {
    return trimmed;
  }

  return `---
title: ${titleFromVaultPath(entryName)}
source: ${entryName.replace(/\\/g, "/")}
---

${trimmed}`;
}

function mapZipSecurityError(error: ZipSecurityError): ObsidianVaultImportError {
  switch (error.code) {
    case "zip_too_large":
      return new ObsidianVaultImportError("ZIP-Datei ist zu groß (max. 10 MB).");
    case "zip_bomb":
      return new ObsidianVaultImportError(
        "Entpackter Markdown-Inhalt überschreitet das Limit von 10 MB.",
      );
    case "too_many_files":
      return new ObsidianVaultImportError(
        `ZIP-Datei enthält zu viele Dateien (max. ${MAX_VAULT_FILES}).`,
      );
    case "zip_slip":
      return new ObsidianVaultImportError("ZIP-Datei enthält unsichere Pfade und wurde abgelehnt.");
    case "blocked_entry":
    case "blocked_content":
      return new ObsidianVaultImportError(
        "ZIP-Datei enthält blockierte Inhalte und wurde abgelehnt.",
      );
    default:
      return new ObsidianVaultImportError("ZIP-Datei konnte nicht gelesen werden.");
  }
}

/** Öffnet das Archiv und liefert die Markdown-Einträge, alle Guards vorgeschaltet. */
function readVaultEntries(zipBuffer: Buffer): SafeZipEntry[] {
  if (zipBuffer.length === 0) {
    throw new ObsidianVaultImportError("ZIP-Datei ist leer.");
  }
  if (zipBuffer.length > MAX_VAULT_ZIP_BYTES) {
    throw new ObsidianVaultImportError("ZIP-Datei ist zu groß (max. 10 MB).");
  }
  if (!(zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4b)) {
    throw new ObsidianVaultImportError("Datei ist kein gültiges ZIP-Archiv.");
  }

  try {
    return extractSafeZipEntries(zipBuffer, {
      policy: VAULT_ZIP_POLICY,
      entryFilter: isObsidianVaultMarkdownEntry,
    });
  } catch (error) {
    if (error instanceof ZipSecurityError) {
      throw mapZipSecurityError(error);
    }
    throw new ObsidianVaultImportError("ZIP-Datei konnte nicht gelesen werden.");
  }
}

/**
 * Dieselben Vault-Dateien, aber **einzeln** statt zu einem Bündel verklebt.
 *
 * Der Dokument-Import braucht die Dateigrenzen: beim Bulk-Wiki ist eine Datei
 * genau eine Seite, und der Dateiname ist der Notnagel für den Titel. Beim
 * verklebten Bündel wäre beides verloren.
 */
export function extractObsidianVaultFiles(zipBuffer: Buffer): ObsidianVaultFile[] {
  const files = readVaultEntries(zipBuffer)
    .slice()
    .sort((a, b) => a.entryName.localeCompare(b.entryName, "en"))
    .map((entry) => ({
      fileName: entry.entryName.replace(/\\/g, "/"),
      content: entry.data.toString("utf8"),
    }))
    .filter((file) => file.content.trim().length > 0);

  if (files.length === 0) {
    throw new ObsidianVaultImportError(
      "Keine Markdown-Dateien im Vault-Export gefunden (.md, .markdown, .txt).",
    );
  }

  const total = files.reduce((sum, file) => sum + file.content.length, 0);
  if (total > MAX_VAULT_MARKDOWN_BYTES) {
    throw new ObsidianVaultImportError(
      "Entpackter Markdown-Inhalt überschreitet das Limit von 10 MB.",
    );
  }

  return files;
}

/**
 * Extract all vault markdown files from an Obsidian vault export ZIP and
 * combine them into one markdown bundle (documents separated by `---`),
 * matching the client-side multi-file combine format.
 *
 * Wikilinks (`[[…]]`) und eingebettete Anhänge bleiben unverändert als Text
 * erhalten — es findet keine Link-Auflösung statt.
 */
export function extractObsidianVaultMarkdown(zipBuffer: Buffer): ObsidianVaultExtractResult {
  const entries = readVaultEntries(zipBuffer);

  const documents = entries
    .slice()
    .sort((a, b) => a.entryName.localeCompare(b.entryName, "en"))
    .map((entry) => ({
      source: entry.entryName.replace(/\\/g, "/"),
      markdown: buildMarkdownDocumentFromVaultFile(entry.entryName, entry.data.toString("utf8")),
    }))
    .filter((document) => document.markdown.length > 0);

  if (documents.length === 0) {
    throw new ObsidianVaultImportError(
      "Keine Markdown-Dateien im Vault-Export gefunden (.md, .markdown, .txt).",
    );
  }

  const markdown = documents.map((document) => document.markdown).join("\n\n---\n\n");
  if (markdown.length > MAX_VAULT_MARKDOWN_BYTES) {
    throw new ObsidianVaultImportError(
      "Entpackter Markdown-Inhalt überschreitet das Limit von 10 MB.",
    );
  }

  return {
    markdown,
    fileCount: documents.length,
    files: documents.map((document) => document.source),
  };
}
