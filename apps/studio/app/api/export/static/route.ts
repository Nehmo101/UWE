import path from "node:path";
import { NextResponse } from "next/server";
import {
  createActivityLogService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { exportWorldStatic } from "@uwe/static-export";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

/**
 * Exports are confined to the exports base directory. The client may only
 * choose a folder name, never an arbitrary filesystem path.
 */
function resolveExportDir(worldSlug: string, requestedDirName?: string): string | null {
  const baseDir = path.resolve(process.env.EXPORTS_DIR ?? "exports");
  const dirName = requestedDirName ?? `${worldSlug}-static`;

  const resolved = path.resolve(baseDir, dirName);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    return null;
  }

  return resolved;
}

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as {
      worldSlug?: string;
      outputDir?: string;
    };

    const worldSlug = body.worldSlug ?? "terra";
    const outputDir = resolveExportDir(worldSlug, body.outputDir);
    if (!outputDir) {
      return NextResponse.json(
        { error: "outputDir muss ein Ordnername innerhalb des Export-Verzeichnisses sein." },
        { status: 400 },
      );
    }

    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return NextResponse.json({ error: `World not found: ${worldSlug}` }, { status: 404 });
    }

    const result = await exportWorldStatic(repo, {
      worldSlug,
      outputDir,
      uploadsDir: process.env.UPLOADS_DIR,
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
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
