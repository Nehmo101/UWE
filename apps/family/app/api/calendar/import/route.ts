import { NextResponse } from "next/server";
import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { applyIcsImport, IcsImportError } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { readIcsUpload, stringList } from "@/src/lib/ics-upload";

/**
 * Übernahme der angehakten Termine aus einer ICS-Datei.
 *
 * Die Datei kommt ein zweites Mal mit — der Browser schickt nur die Auswahl,
 * den Inhalt liest der Server erneut aus der Datei. Sonst könnte die Seite
 * bestimmen, was in den Kalender wandert, und nicht die Datei.
 *
 * Übernommen wird in den lokalen Feed: danach sind es ganz normale
 * Haushalts-Termine, änderbar und löschbar. Ein Abo wird daraus nicht — das
 * steht unter „Fremde Kalender".
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const text = await readIcsUpload(formData);

    const result = await applyIcsImport({
      familyDb: familyPrisma,
      calendar: createCalendarService(familyPrisma, prisma),
      text,
      selectedUids: stringList(formData, "uids"),
      memberIds: stringList(formData, "memberIds"),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IcsImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
