import { NextResponse } from "next/server";
import {
  createJobService,
  createUweRepository,
  prisma,
} from "@uwe/database/server";
import {
  importSourceRegistry,
  parseImportContent,
  previewFromContent,
  type ImportFormat,
} from "@uwe/knoteforge-import";
import { enqueueAndDispatch, runJob } from "./job-executor";

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
  sync?: boolean;
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

  try {
    parseImportContent(body.format, body.content);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Import-Datei konnte nicht gelesen werden.",
    );
  }

  const title = `Import (${body.format}) → ${body.worldSlug}`;

  if (body.sync) {
    const jobs = createJobService(prisma);
    const job = await jobs.enqueue({
      type: "import",
      title,
      worldSlug: body.worldSlug,
      payload: {
        format: body.format,
        content: body.content,
        worldSlug: body.worldSlug,
        itemIds: body.itemIds,
        autoResolveSlugConflicts: body.autoResolveSlugConflicts,
        allowUpdates: body.allowUpdates,
      },
    });
    const completed = await runJob(job.id);
    if (completed?.status === "failed") {
      return NextResponse.json(
        { error: completed.errorMessage ?? "Import fehlgeschlagen." },
        { status: 500 },
      );
    }
    return NextResponse.json({ job: completed, result: completed?.result });
  }

  const job = await enqueueAndDispatch({
    type: "import",
    title,
    worldSlug: body.worldSlug,
    payload: {
      format: body.format,
      content: body.content,
      worldSlug: body.worldSlug,
      itemIds: body.itemIds,
      autoResolveSlugConflicts: body.autoResolveSlugConflicts,
      allowUpdates: body.allowUpdates,
    },
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function getImportFormats() {
  return NextResponse.json({
    supported: importSourceRegistry.supportedFormats(),
    planned: importSourceRegistry.plannedFormats(),
  });
}
