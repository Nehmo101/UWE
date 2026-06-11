import type { ImportSource } from "../interface";
import { UnsupportedImportFormatError } from "../interface";
import type { NormalizedImportBundle } from "../types";

/**
 * Markdown import parser — prepared for a future KnoteForge export format.
 * Will parse frontmatter + body into NormalizedImportBundle entities.
 */
export class MarkdownImportSource implements ImportSource {
  readonly format = "markdown" as const;

  parse(_content: string): NormalizedImportBundle {
    throw new UnsupportedImportFormatError("markdown");
  }

  validate(_bundle: NormalizedImportBundle): string[] {
    return ["Markdown-Import ist noch nicht implementiert."];
  }
}
