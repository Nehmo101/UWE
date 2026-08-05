import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { IcsImportError, previewIcsImport } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { readIcsUpload } from "@/src/lib/ics-upload";

/**
 * Vorschau eines ICS-Imports: was stünde nachher im Kalender?
 *
 * Schreibt nichts. Der Weg über eine Route statt über eine Server Action ist
 * derselbe wie beim Scan-Upload — es kommt eine Datei, und die Seite soll das
 * Ergebnis zeigen, ohne neu zu laden.
 *
 * Bewusst nur sitzungsgebunden, ohne Token-Scope: das hier bedient die
 * Oberfläche, nicht die Family-API v1.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth();
  if (denied) return denied;

  try {
    const text = await readIcsUpload(await request.formData());
    return NextResponse.json(await previewIcsImport(familyPrisma, text));
  } catch (error) {
    if (error instanceof IcsImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
