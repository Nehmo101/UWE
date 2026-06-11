import type { ImportSource } from "../interface";
import { UnsupportedImportFormatError } from "../interface";
import type { NormalizedImportBundle } from "../types";

/**
 * HTML import parser — prepared for a future KnoteForge export format.
 * Will extract structured data from HTML exports into NormalizedImportBundle.
 */
export class HtmlImportSource implements ImportSource {
  readonly format = "html" as const;

  parse(_content: string): NormalizedImportBundle {
    throw new UnsupportedImportFormatError("html");
  }

  validate(_bundle: NormalizedImportBundle): string[] {
    return ["HTML-Import ist noch nicht implementiert."];
  }
}
