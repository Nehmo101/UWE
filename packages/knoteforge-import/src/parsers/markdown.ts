import type { ImportSource } from "../interface";
import type { NormalizedImportBundle } from "../types";
import { parseMarkdownBundle } from "./markdown-parse";

/**
 * Markdown/text import — supports multiple unstructured documents in one file.
 *
 * Documents are separated by a line containing only `---`.
 * Optional YAML-like frontmatter per document:
 *
 * ---
 * title: Mein NPC
 * type: wissenstext
 * tags: npc, stadt
 * ---
 *
 * Inhalt mit [[Wikilinks]] …
 */
export class MarkdownImportSource implements ImportSource {
  readonly format = "markdown" as const;

  parse(content: string): NormalizedImportBundle {
    const entities = parseMarkdownBundle(content);

    return {
      version: "1.0",
      source: "knoteforge",
      exportedAt: new Date().toISOString(),
      entities,
      assets: [],
    };
  }

  validate(bundle: NormalizedImportBundle): string[] {
    const errors: string[] = [];

    if (bundle.entities.length === 0) {
      errors.push("Keine importierbaren Texte gefunden.");
    }

    const ids = new Set<string>();
    for (const entity of bundle.entities) {
      if (!entity.title?.trim()) {
        errors.push("Mindestens ein Eintrag hat keinen Titel.");
      }

      if (entity.id) {
        if (ids.has(entity.id)) {
          errors.push(`Doppelte Import-ID „${entity.id}".`);
        }
        ids.add(entity.id);
      }
    }

    return errors;
  }
}
