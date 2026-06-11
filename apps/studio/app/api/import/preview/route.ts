import { postImportPreview } from "../../../../src/lib/import-handlers";
import type { ImportFormat } from "@uwe/knoteforge-import";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    format: ImportFormat;
    content: string;
    worldSlug: string;
  };

  try {
    return await postImportPreview(body);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Import-Vorschau fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}
