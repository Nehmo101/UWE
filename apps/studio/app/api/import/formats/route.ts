import { getImportFormats } from "../../../../src/lib/import-handlers";

export async function GET() {
  try {
    return await getImportFormats();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Formate konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
