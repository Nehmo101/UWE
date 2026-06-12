import { postImportExecute } from "../../../../src/lib/import-handlers";
import type { ImportFormat } from "@uwe/knoteforge-import";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    format: ImportFormat;
    content: string;
    worldSlug: string;
    confirmed?: boolean;
    itemIds?: string[];
    autoResolveSlugConflicts?: boolean;
    allowUpdates?: boolean;
  };

  try {
    return await postImportExecute(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import fehlgeschlagen." },
      { status: 500 },
    );
  }
}
