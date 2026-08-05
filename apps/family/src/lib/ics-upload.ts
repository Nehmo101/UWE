import { ICS_IMPORT_MAX_BYTES, IcsImportError } from "@uwe/family-core";

/**
 * Die hochgeladene Kalenderdatei als Text — gemeinsam für Vorschau und
 * Übernahme, damit beide dieselben Grenzen ziehen.
 *
 * Der MIME-Typ wird nicht geprüft: Kalender-Apps und Mail-Programme schicken
 * `text/calendar`, `application/octet-stream` oder gar nichts. Ob es eine
 * Kalenderdatei ist, entscheidet der Inhalt (`readIcsFile`), nicht die
 * Behauptung des Browsers.
 */
export async function readIcsUpload(formData: FormData): Promise<string> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new IcsImportError("Bitte eine ICS-Datei auswählen.");
  }
  if (file.size > ICS_IMPORT_MAX_BYTES) {
    throw new IcsImportError(
      `Die Datei ist zu groß (max. ${Math.round(ICS_IMPORT_MAX_BYTES / 1000)} kB).`,
    );
  }

  return file.text();
}

/** Wiederholte Formularfelder als saubere Liste. */
export function stringList(formData: FormData, field: string): string[] {
  return formData
    .getAll(field)
    .map((value) => String(value).trim())
    .filter((value) => value !== "");
}
