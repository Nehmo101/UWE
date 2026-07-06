import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { jsonError } from "@/src/lib/api-response";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  createActivityLogService,
  getAppRepository,
  getSystemSettings,
  prisma,
  resolveEffectiveExportsPath,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { exportWorldStatic } from "@uwe/static-export";
import {
  guardStudioMutation,
  optionalString,
  parseBody,
  safeHandlerError,
  slugSchema,
} from "@uwe/security";
import { z } from "zod";

const staticExportBodySchema = z.object({
  worldSlug: slugSchema.optional().default("terra"),
  outputDir: optionalString,
});

/**
 * Exports are confined to the exports base directory. The client may only
 * choose a folder name, never an arbitrary filesystem path.
 */
async function resolveExportDir(worldSlug: string, requestedDirName?: string): Promise<string | null> {
  const settings = await getSystemSettings();
  const baseDir = resolveEffectiveExportsPath(settings);
  const dirName = requestedDirName ?? `${worldSlug}-static`;

  const resolved = path.resolve(baseDir, dirName);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    return null;
  }

  return resolved;
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseBody(request, staticExportBodySchema);
  if (!parsed.success) return parsed.response;

  try {
    const worldSlug = parsed.data.worldSlug;
    const outputDir = await resolveExportDir(worldSlug, parsed.data.outputDir);
    if (!outputDir) {
      return jsonError("outputDir muss ein Ordnername innerhalb des Export-Verzeichnisses sein.", 400);
    }

    const repo = getAppRepository();
    const settings = await getSystemSettings();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return jsonError(`World not found: ${worldSlug}`, 404);
    }
    if (world.isSandbox) {
      return jsonError("Sandbox-Testwelten können nicht exportiert werden.", 400);
    }

    const result = await exportWorldStatic(repo, {
      worldSlug,
      outputDir,
      uploadsDir: resolveEffectiveUploadsPath(settings),
    });

    await createActivityLogService(prisma).log({
      worldId: world.id,
      worldSlug,
      action: "export_executed",
      targetType: "world",
      targetId: world.id,
      targetLabel: world.name,
      targetHref: `/worlds/${worldSlug}`,
      summary: `Statischer Export für Welt „${world.name}“ erstellt.`,
      details: { outputDir: path.basename(outputDir) },
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return safeHandlerError(error, "Export failed");
  }
}
