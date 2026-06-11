import { NextResponse } from "next/server";
import { createUweRepository } from "@uwe/database/server";
import {
  executeImport,
  importSourceRegistry,
  parseImportContent,
  previewFromContent,
  type ImportExecuteOptions,
  type ImportFormat,
} from "@uwe/knoteforge-import";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export interface ImportRequestBody {
  format: ImportFormat;
  content: string;
  worldSlug: string;
  confirmed?: boolean;
  itemIds?: string[];
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
}

function validateBody(body: ImportRequestBody): string | null {
  if (!body.format || !body.content || !body.worldSlug) {
    return "format, content und worldSlug sind erforderlich.";
  }

  if (!importSourceRegistry.supportedFormats().includes(body.format)) {
    const planned = importSourceRegistry.plannedFormats();
    if (planned.includes(body.format)) {
      return `Format „${body.format}" ist geplant, aber noch nicht verfügbar.`;
    }
    return `Unbekanntes Import-Format „${body.format}".`;
  }

  if (body.content.length > 10 * 1024 * 1024) {
    return "Import-Datei ist zu groß (max. 10 MB).";
  }

  return null;
}

export async function postImportPreview(body: ImportRequestBody) {
  const validationError = validateBody(body);
  if (validationError) {
    return jsonError(validationError);
  }

  const repo = createUweRepository();

  try {
    parseImportContent(body.format, body.content);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Import-Datei konnte nicht gelesen werden.",
    );
  }

  try {
    const preview = await previewFromContent(
      repo,
      body.format,
      body.content,
      body.worldSlug,
    );
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Import-Vorschau fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}

export async function postImportExecute(body: ImportRequestBody) {
  const validationError = validateBody(body);
  if (validationError) {
    return jsonError(validationError);
  }

  if (!body.confirmed) {
    return jsonError(
      "Import erfordert confirmed: true. Führe zuerst eine Vorschau durch.",
    );
  }

  const repo = createUweRepository();

  let bundle;
  try {
    ({ bundle } = parseImportContent(body.format, body.content));
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Import-Datei konnte nicht gelesen werden.",
    );
  }

  const options: ImportExecuteOptions = {
    confirmed: true,
    itemIds: body.itemIds,
    autoResolveSlugConflicts: body.autoResolveSlugConflicts ?? true,
    allowUpdates: body.allowUpdates ?? true,
  };

  try {
    const result = await executeImport(
      repo,
      bundle,
      body.worldSlug,
      body.format,
      options,
    );
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}

export async function getImportFormats() {
  return NextResponse.json({
    supported: importSourceRegistry.supportedFormats(),
    planned: importSourceRegistry.plannedFormats(),
  });
}
