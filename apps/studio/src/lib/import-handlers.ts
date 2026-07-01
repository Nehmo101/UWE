import { NextResponse } from "next/server";
import {
  createJobService,
  createUweRepository,
  logAuditEvent,
  prisma,
} from "@uwe/database/server";
import {
  importSourceRegistry,
  parseImportContent,
  previewFromContent,
  type ImportFormat,
} from "@uwe/knoteforge-import";
import { enqueueAndDispatch, runJob } from "./job-executor";
import { jsonError } from "./api-response";

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
  const world = await createUweRepository().getWorldBySlug(body.worldSlug);

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

    await logAuditEvent(prisma, {
      action: "import_started",
      targetType: "import",
      targetId: job.id,
      worldId: world?.id,
      metadata: { format: body.format, sync: true },
    });

    const completed = await runJob(job.id);
    if (completed?.status === "failed") {
      await logAuditEvent(prisma, {
        action: "import_failed",
        targetType: "import",
        targetId: job.id,
        worldId: world?.id,
        metadata: { format: body.format, error: completed.errorMessage },
      });

      return NextResponse.json(
        { error: completed.errorMessage ?? "Import fehlgeschlagen." },
        { status: 500 },
      );
    }

    await logAuditEvent(prisma, {
      action: "import_completed",
      targetType: "import",
      targetId: job.id,
      worldId: world?.id,
      metadata: { format: body.format },
    });

    return NextResponse.json({
      job: completed,
      result: completed?.result,
      undoEntryId:
        completed?.result && typeof completed.result === "object" && completed.result !== null
          ? (completed.result as { undoEntryId?: string | null }).undoEntryId ?? null
          : null,
    });
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

  await logAuditEvent(prisma, {
    action: "import_started",
    targetType: "import",
    targetId: job.id,
    worldId: world?.id,
    metadata: { format: body.format, async: true },
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function getImportFormats() {
  return NextResponse.json({
    supported: importSourceRegistry.supportedFormats(),
    planned: importSourceRegistry.plannedFormats(),
  });
}
