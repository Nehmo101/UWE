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
    { id: "rarity", label: "Seltenheit", kind: "text", placeholder: "z. B. ungewöhnlich" },
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
