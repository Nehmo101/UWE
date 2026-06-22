import type { ImportSource } from "../interface";
import { ImportParseError } from "../interface";
import type { KnoteForgeExport, NormalizedImportBundle } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ImportParseError(`Pflichtfeld „${field}" fehlt oder ist ungültig.`);
  }
  return value.trim();
}

function asOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  return value;
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function parseEntity(raw: unknown, index: number): KnoteForgeExport["entities"][number] {
  if (!isRecord(raw)) {
    throw new ImportParseError(`Entity an Index ${index} ist kein Objekt.`);
  }

  const title = asOptionalString(raw.title) ?? "";
  const type = asOptionalString(raw.type);
  if (!type?.trim()) {
    throw new ImportParseError(`Entity an Index ${index}: Pflichtfeld „type" fehlt.`);
  }

  return {
    id: asOptionalString(raw.id) ?? undefined,
    type: type.trim(),
    title: title.trim(),
    slug: asOptionalString(raw.slug) ?? undefined,
    summary: asOptionalString(raw.summary),
    content: asOptionalString(raw.content),
    playerContent: asOptionalString(raw.playerContent),
    gmContent: asOptionalString(raw.gmContent),
    tags: asStringArray(raw.tags),
    aliases: asStringArray(raw.aliases),
    visibility: asOptionalString(raw.visibility),
    publishStatus: asOptionalString(raw.publishStatus),
    parentId: asOptionalString(raw.parentId),
    relations: Array.isArray(raw.relations)
      ? raw.relations
          .filter(isRecord)
          .map((rel) => ({
            targetId: asString(rel.targetId, "relations[].targetId"),
            relationType: asString(rel.relationType, "relations[].relationType"),
            label: asOptionalString(rel.label),
          }))
      : undefined,
    metadata: isRecord(raw.metadata) ? raw.metadata : undefined,
  };
}

function parseAsset(raw: unknown, index: number): NonNullable<KnoteForgeExport["assets"]>[number] {
  if (!isRecord(raw)) {
    throw new ImportParseError(`Asset an Index ${index} ist kein Objekt.`);
  }

  return {
    id: asOptionalString(raw.id) ?? undefined,
    filename: asString(raw.filename, "assets[].filename"),
    path: asOptionalString(raw.path),
    hash: asOptionalString(raw.hash),
    type: asOptionalString(raw.type),
    mimeType: asOptionalString(raw.mimeType),
  };
}

function normalizeExport(raw: KnoteForgeExport): NormalizedImportBundle {
  return {
    version: raw.version,
    source: "knoteforge",
    exportedAt: raw.exportedAt,
    world: raw.world,
    entities: raw.entities,
    assets: raw.assets ?? [],
  };
}

function isRawInputEntry(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw)) return false;
  return (
    "raw_text" in raw ||
    "structured_preview" in raw ||
    ("priority" in raw && "status" in raw && ("title" in raw || "id" in raw))
  );
}

function titleFromRawInput(raw: Record<string, unknown>): string {
  const title = asOptionalString(raw.title)?.trim();
  if (title) return title;

  const rawText = asOptionalString(raw.raw_text)?.trim();
  if (rawText) {
    const firstLine = rawText.split(/\r?\n/).find((line) => line.trim())?.trim();
    if (firstLine) return firstLine.slice(0, 120);
  }

  const id = raw.id;
  if (typeof id === "number" || typeof id === "string") {
    return `Eingang #${id}`;
  }

  return "Eingang";
}

function parseRawInputEntry(
  raw: Record<string, unknown>,
  index: number,
): KnoteForgeExport["entities"][number] {
  const idValue = raw.id;
  const knoteforgeId =
    typeof idValue === "number" || typeof idValue === "string"
      ? `eingang-${idValue}`
      : `eingang-${index + 1}`;

  const metadata: Record<string, unknown> = {
    knoteforgeExport: "eingang",
  };

  const source = asOptionalString(raw.source);
  if (source) metadata.knoteforgeSource = source;

  const status = asOptionalString(raw.status);
  if (status) metadata.knoteforgeStatus = status;

  const priority = asOptionalString(raw.priority);
  if (priority) metadata.knoteforgePriority = priority;

  const createdAt = asOptionalString(raw.created_at);
  if (createdAt) metadata.knoteforgeCreatedAt = createdAt;

  const updatedAt = asOptionalString(raw.updated_at);
  if (updatedAt) metadata.knoteforgeUpdatedAt = updatedAt;

  return {
    id: knoteforgeId,
    type: "session_notiz",
    title: titleFromRawInput(raw),
    content: asOptionalString(raw.raw_text) ?? "",
    gmContent: asOptionalString(raw.structured_preview) ?? undefined,
    visibility: "dm_only",
    publishStatus: "draft",
    metadata,
  };
}

function parseRawInputArray(parsed: unknown[]): NormalizedImportBundle {
  if (parsed.length === 0) {
    throw new ImportParseError("Import-Datei enthält keine Eingang-Einträge.");
  }

  if (!parsed.every(isRawInputEntry)) {
    throw new ImportParseError(
      "Import-Datei ist ein JSON-Array, aber nicht im erkannten KnoteForge-Eingang-Format.",
    );
  }

  return normalizeExport({
    version: "1.0",
    source: "knoteforge",
    exportedAt: new Date().toISOString(),
    entities: parsed.map((entry, index) => parseRawInputEntry(entry, index)),
    assets: [],
  });
}

function parseBundleObject(parsed: Record<string, unknown>): NormalizedImportBundle {
  const version = asString(parsed.version, "version");
  const source = asString(parsed.source, "source");
  if (source !== "knoteforge") {
    throw new ImportParseError('Feld „source" muss „knoteforge" sein.');
  }

  if (!Array.isArray(parsed.entities)) {
    throw new ImportParseError('Feld „entities" muss ein Array sein.');
  }

  const entities = parsed.entities.map((entity, index) => parseEntity(entity, index));
  const assets = Array.isArray(parsed.assets)
    ? parsed.assets.map((asset, index) => parseAsset(asset, index))
    : [];

  let world: KnoteForgeExport["world"];
  if (parsed.world !== undefined) {
    if (!isRecord(parsed.world)) {
      throw new ImportParseError('Feld „world" muss ein Objekt sein.');
    }
    world = {
      name: asString(parsed.world.name, "world.name"),
      slug: asString(parsed.world.slug, "world.slug"),
      description: asOptionalString(parsed.world.description),
    };
  }

  return normalizeExport({
    version,
    source: "knoteforge",
    exportedAt: asOptionalString(parsed.exportedAt) ?? undefined,
    world,
    entities,
    assets,
  });
}

export class JsonImportSource implements ImportSource {
  readonly format = "json" as const;

  parse(content: string): NormalizedImportBundle {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ImportParseError("JSON konnte nicht geparst werden.");
    }

    if (Array.isArray(parsed)) {
      return parseRawInputArray(parsed);
    }

    if (!isRecord(parsed)) {
      throw new ImportParseError(
        "Import-Datei muss ein JSON-Objekt oder ein KnoteForge-Eingang-Array sein.",
      );
    }

    return parseBundleObject(parsed);
  }

  validate(bundle: NormalizedImportBundle): string[] {
    const errors: string[] = [];

    if (!bundle.version) {
      errors.push("version fehlt.");
    }

    if (bundle.entities.length === 0) {
      errors.push("Keine Entities zum Importieren gefunden.");
    }

    const ids = new Set<string>();
    for (const entity of bundle.entities) {
      if (entity.id) {
        if (ids.has(entity.id)) {
          errors.push(`Doppelte Entity-ID „${entity.id}".`);
        }
        ids.add(entity.id);
      }
    }

    return errors;
  }
}
