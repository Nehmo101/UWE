import { NextResponse } from "next/server";
import { getAppRepository } from "@uwe/database/server";
import { exportWorldStatic } from "@uwe/static-export";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      worldSlug?: string;
      outputDir?: string;
    };

    const worldSlug = body.worldSlug ?? "terra";
    const outputDir =
      body.outputDir ??
      process.env.EXPORTS_DIR ??
      `exports/${worldSlug}-static`;

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

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
