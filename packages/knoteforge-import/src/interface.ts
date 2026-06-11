import type { ImportFormat, NormalizedImportBundle } from "./types";

export class UnsupportedImportFormatError extends Error {
  constructor(format: ImportFormat) {
    super(`Import-Format „${format}" wird noch nicht unterstützt.`);
    this.name = "UnsupportedImportFormatError";
  }
}

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

/** Generic import source — each format implements this interface. */
export interface ImportSource {
  readonly format: ImportFormat;
  parse(content: string): NormalizedImportBundle;
  validate(bundle: NormalizedImportBundle): string[];
}

export interface ImportSourceRegistry {
  get(format: ImportFormat): ImportSource;
  supportedFormats(): ImportFormat[];
  plannedFormats(): ImportFormat[];
}
