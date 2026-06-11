import type { ImportFormat } from "./types";
import type { ImportSource, ImportSourceRegistry } from "./interface";
import { HtmlImportSource } from "./parsers/html";
import { JsonImportSource } from "./parsers/json";
import { MarkdownImportSource } from "./parsers/markdown";

const sources: Record<ImportFormat, ImportSource> = {
  json: new JsonImportSource(),
  markdown: new MarkdownImportSource(),
  html: new HtmlImportSource(),
};

export const importSourceRegistry: ImportSourceRegistry = {
  get(format: ImportFormat): ImportSource {
    return sources[format];
  },
  supportedFormats(): ImportFormat[] {
    return ["json"];
  },
  plannedFormats(): ImportFormat[] {
    return ["markdown", "html"];
  },
};

export function parseImportContent(
  format: ImportFormat,
  content: string,
) {
  const source = importSourceRegistry.get(format);
  const bundle = source.parse(content);
  const validationErrors = source.validate(bundle);
  return { bundle, validationErrors, source };
}
