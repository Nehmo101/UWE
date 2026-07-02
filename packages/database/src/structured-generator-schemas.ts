import type { GeneratorContextType } from "./generator-service";

export type StructuredGeneratorTarget = Extract<GeneratorContextType, "npc" | "quest" | "item">;

export interface StructuredGeneratorField {
  id: string;
  label: string;
  kind: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
}

export interface StructuredGeneratorSchema {
  targetType: StructuredGeneratorTarget;
  label: string;
  description: string;
  fields: StructuredGeneratorField[];
}

export interface StructuredGeneratorOutput {
  fields: Record<string, string>;
  summary?: string | null;
  playerText?: string | null;
}

const NPC_SCHEMA: StructuredGeneratorSchema = {
  targetType: "npc",
  label: "NPC (strukturiert)",
  description: "Stimme, Motivation, Beziehungen und Plot-Nutzen als strukturiertes JSON.",
  fields: [
    { id: "voice", label: "Stimme / Auftreten", kind: "textarea", placeholder: "Wie spricht und wirkt die Person?" },
    { id: "motivation", label: "Motivation", kind: "textarea", required: true },
    { id: "relationship", label: "Beziehung zur Gruppe", kind: "textarea" },
    { id: "plotHook", label: "Plot-Nutzen / Hook", kind: "textarea" },
    { id: "secret", label: "Geheimnis (DM-only)", kind: "textarea" },
  ],
};

const QUEST_SCHEMA: StructuredGeneratorSchema = {
  targetType: "quest",
  label: "Quest (strukturiert)",
  description: "Auftraggeber, Ziel, Twist und Scheitern als strukturiertes JSON.",
  fields: [
    { id: "patron", label: "Auftraggeber", kind: "text", required: true },
    { id: "objective", label: "Ziel / Auftrag", kind: "textarea", required: true },
    { id: "twist", label: "Twist / Komplikation", kind: "textarea" },
    { id: "failure", label: "Scheitern / Konsequenz", kind: "textarea" },
    { id: "reward", label: "Belohnung", kind: "textarea" },
  ],
};

const ITEM_SCHEMA: StructuredGeneratorSchema = {
  targetType: "item",
  label: "Item (strukturiert)",
  description: "Eigenschaften, Seltenheit und Lore als strukturiertes JSON.",
  fields: [
    {
      id: "srdBase",
      label: "SRD-Basis (Open5e/SRD)",
      kind: "textarea",
      placeholder: "Basisgegenstand aus SRD/Open5e — Attribution beachten",
    },
    { id: "rarity", label: "Seltenheit", kind: "text", placeholder: "z. B. ungewöhnlich" },
    {
      id: "attunement",
      label: "Einstimmung (Attunement)",
      kind: "text",
      placeholder: "z. B. erfordert Einstimmung durch einen Zauberwirker",
    },
    { id: "properties", label: "Eigenschaften / Mechanik", kind: "textarea", required: true },
    { id: "value", label: "Wert / Preis", kind: "text" },
    { id: "curse", label: "Fluch / Nachteil (optional)", kind: "textarea" },
    { id: "lore", label: "Lore / Herkunft", kind: "textarea" },
  ],
};

const SCHEMAS: Record<StructuredGeneratorTarget, StructuredGeneratorSchema> = {
  npc: NPC_SCHEMA,
  quest: QUEST_SCHEMA,
  item: ITEM_SCHEMA,
};

export function getStructuredGeneratorSchema(
  targetType: StructuredGeneratorTarget,
): StructuredGeneratorSchema {
  return SCHEMAS[targetType];
}

export function isStructuredGeneratorTarget(
  value: string,
): value is StructuredGeneratorTarget {
  return value === "npc" || value === "quest" || value === "item";
}

export const STRUCTURED_GENERATOR_FIELD_MAX_LENGTH = 4000;

export interface StructuredGeneratorInputIssue {
  fieldId: string | null;
  message: string;
}

export interface StructuredGeneratorInputResult {
  ok: boolean;
  /** Trimmed values for known, non-empty fields. */
  values: Record<string, string>;
  issues: StructuredGeneratorInputIssue[];
}

/**
 * Validates structured generator input against a schema: unknown field ids,
 * missing required fields and overlong values are rejected. Returns trimmed
 * values for the known fields.
 */
export function validateStructuredGeneratorInput(
  schema: StructuredGeneratorSchema,
  input: Record<string, string> | undefined,
): StructuredGeneratorInputResult {
  const issues: StructuredGeneratorInputIssue[] = [];
  const values: Record<string, string> = {};
  const knownFields = new Map(schema.fields.map((field) => [field.id, field]));

  for (const [key, raw] of Object.entries(input ?? {})) {
    const field = knownFields.get(key);
    if (!field) {
      issues.push({
        fieldId: key,
        message: `Unbekanntes Feld „${key}" für ${schema.label}.`,
      });
      continue;
    }
    if (typeof raw !== "string") {
      issues.push({ fieldId: key, message: `Feld „${field.label}" muss Text sein.` });
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length > STRUCTURED_GENERATOR_FIELD_MAX_LENGTH) {
      issues.push({
        fieldId: key,
        message: `Feld „${field.label}" ist zu lang (max. ${STRUCTURED_GENERATOR_FIELD_MAX_LENGTH} Zeichen).`,
      });
      continue;
    }
    if (trimmed) {
      values[key] = trimmed;
    }
  }

  for (const field of schema.fields) {
    if (field.required && !values[field.id]) {
      issues.push({ fieldId: field.id, message: `Feld „${field.label}" ist erforderlich.` });
    }
  }

  return { ok: issues.length === 0, values, issues };
}

export interface GeneratorPresetTemplateFields {
  structured: boolean;
  fieldIds: string[];
  defaults: Record<string, string>;
}

/**
 * Parses a GeneratorPreset.template JSON value into its structured parts
 * (`structured`, `fields`, `defaults`). Unknown shapes yield empty results.
 */
export function parseGeneratorPresetTemplate(template: unknown): GeneratorPresetTemplateFields {
  if (typeof template !== "object" || template === null || Array.isArray(template)) {
    return { structured: false, fieldIds: [], defaults: {} };
  }

  const record = template as Record<string, unknown>;
  const fieldIds = Array.isArray(record.fields)
    ? record.fields.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  const defaults: Record<string, string> = {};
  if (
    typeof record.defaults === "object" &&
    record.defaults !== null &&
    !Array.isArray(record.defaults)
  ) {
    for (const [key, value] of Object.entries(record.defaults as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        defaults[key] = value.trim();
      }
    }
  }

  return { structured: record.structured === true, fieldIds, defaults };
}

/**
 * Applies a GeneratorPreset template to a structured schema: keeps the fields
 * requested by the preset plus all required fields. Falls back to the full
 * schema when the template selects no known fields.
 */
export function applyGeneratorPresetToSchema(
  schema: StructuredGeneratorSchema,
  template: unknown,
): StructuredGeneratorSchema {
  const parsed = parseGeneratorPresetTemplate(template);
  const requested = new Set(parsed.fieldIds);
  if (requested.size === 0) {
    return schema;
  }

  const hasKnownField = schema.fields.some((field) => requested.has(field.id));
  if (!hasKnownField) {
    return schema;
  }

  return {
    ...schema,
    fields: schema.fields.filter((field) => field.required || requested.has(field.id)),
  };
}

export function buildStructuredGeneratorPrompt(
  schema: StructuredGeneratorSchema,
  pageTitle: string,
  input: Record<string, string>,
): string {
  const filled = schema.fields
    .map((field) => {
      const value = input[field.id]?.trim();
      if (!value) {
        return null;
      }
      return `- ${field.label}: ${value}`;
    })
    .filter(Boolean)
    .join("\n");

  return [
    `Strukturierter Generator für „${pageTitle}" (${schema.label}).`,
    "Nutze die Eingaben und ergänze sinnvoll — keine Kanon-Änderung ohne Review.",
    "",
    "Eingaben:",
    filled || "(keine Vorgaben)",
    "",
    "Antworte NUR als JSON:",
    '{"fields":{"feldId":"wert",...},"summary":"Kurzbeschreibung optional","playerText":"Spielertext optional"}',
    "Verwende exakt die Feld-IDs aus dem Schema:",
    schema.fields.map((field) => field.id).join(", "),
  ].join("\n");
}

export function parseStructuredGeneratorOutput(
  content: string,
  schema: StructuredGeneratorSchema,
): StructuredGeneratorOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Strukturierter Generator muss gültiges JSON liefern.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("JSON muss ein Objekt sein.");
  }

  const record = parsed as Record<string, unknown>;
  const rawFields =
    typeof record.fields === "object" && record.fields !== null
      ? (record.fields as Record<string, unknown>)
      : record;

  const fields: Record<string, string> = {};
  for (const field of schema.fields) {
    const raw = rawFields[field.id];
    if (typeof raw === "string" && raw.trim()) {
      fields[field.id] = raw.trim();
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new Error("JSON enthält keine strukturierten Felder.");
  }

  return {
    fields,
    summary: typeof record.summary === "string" ? record.summary.trim() : null,
    playerText: typeof record.playerText === "string" ? record.playerText.trim() : null,
  };
}

export function formatStructuredGeneratorMarkdown(
  schema: StructuredGeneratorSchema,
  output: StructuredGeneratorOutput,
): string {
  const lines = schema.fields
    .map((field) => {
      const value = output.fields[field.id];
      if (!value) {
        return null;
      }
      return `**${field.label}:** ${value}`;
    })
    .filter(Boolean);

  return lines.join("\n\n");
}

export const STRUCTURED_GENERATOR_SCHEMAS = SCHEMAS;
