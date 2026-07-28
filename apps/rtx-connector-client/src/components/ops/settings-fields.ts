/**
 * Editable system settings, as the Command Center presents them.
 *
 * This is the presentation contract only — labels, ordering and input kind.
 * What may actually be written is decided by `validateSettingsUpdate` in
 * `@uwe/database`; a field listed here that the validator rejects fails loudly
 * on save rather than being silently dropped.
 *
 * Deliberately absent: appearance and themes (they stay in Studio, where they
 * are seen), the SMTP credentials and AI keys (secret material, written via
 * their own flows) and everything the settings read only projects.
 */

export type SettingsFieldKind = "boolean" | "text" | "textarea" | "number" | "select";

export interface SettingsField {
  /** Settings group, e.g. `backup` — the top-level key of the update body. */
  group: string;
  /** Key inside the group. */
  key: string;
  label: string;
  kind: SettingsFieldKind;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  /** Numeric bounds, mirrored from the server-side validation for early feedback. */
  min?: number;
  max?: number;
}

export interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  fields: SettingsField[];
}

const CANONICAL_STATUS_OPTIONS = [
  { value: "idea", label: "Idee" },
  { value: "draft", label: "Entwurf" },
  { value: "prepared", label: "Vorbereitet" },
  { value: "played", label: "Gespielt" },
  { value: "canon", label: "Kanon" },
  { value: "deprecated", label: "Überholt" },
  { value: "contradictory", label: "Widersprüchlich" },
  { value: "non_canon", label: "Nicht-Kanon" },
  { value: "discarded", label: "Verworfen" },
];

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "portal",
    title: "Portal",
    description: "Das Spieler-Wiki. Wer das Häkchen „Portal“ hat, kommt hinein.",
    fields: [
      { group: "portal", key: "portalEnabled", label: "Portal aktiv", kind: "boolean" },
    ],
  },
  {
    id: "worlds",
    title: "Welten & Kampagnen",
    description: "Vorgaben für neu angelegte Inhalte.",
    fields: [
      {
        group: "worlds",
        key: "defaultCanonicalStatus",
        label: "Standard-Kanonstatus",
        kind: "select",
        options: CANONICAL_STATUS_OPTIONS,
      },
      {
        group: "campaigns",
        key: "inheritWorldDefaults",
        label: "Kampagnen erben Welt-Vorgaben",
        kind: "boolean",
      },
    ],
  },
  {
    id: "ai",
    title: "KI",
    description: "Jede KI-Aktion läuft über den RTX-Host. Es gibt keinen Cloud-Provider.",
    fields: [
      { group: "ai", key: "enabled", label: "KI aktiv", kind: "boolean" },
      {
        group: "ai",
        key: "localOnlyMode",
        label: "Nur lokale Inferenz",
        kind: "boolean",
        hint: "Erzwingt den RTX-Host für jede Anfrage.",
      },
      {
        group: "ai",
        key: "generalChatSystemPrompt",
        label: "System-Prompt für den allgemeinen Chat",
        kind: "textarea",
        hint: "Leer = eingebauter Standard. Max. 12000 Zeichen.",
      },
    ],
  },
  {
    id: "mail",
    title: "Mail",
    description: "Postfach-Abruf und Absender. SMTP-Zugangsdaten laufen über Deployment.",
    fields: [
      { group: "mail", key: "enabled", label: "Mail aktiv", kind: "boolean" },
      { group: "mail", key: "fromDisplayName", label: "Absendername", kind: "text" },
      {
        group: "mail",
        key: "logBody",
        label: "Nachrichtentext protokollieren",
        kind: "boolean",
        hint: "Aus lassen, solange du es nicht zur Fehlersuche brauchst.",
      },
      { group: "mail", key: "inboxLimit", label: "Posteingang-Limit", kind: "number", min: 10, max: 5000 },
      { group: "mail", key: "autoSyncEnabled", label: "Automatisch abrufen", kind: "boolean" },
      {
        group: "mail",
        key: "autoSyncIntervalMinutes",
        label: "Abruf-Intervall",
        kind: "select",
        options: [
          { value: "5", label: "5 Minuten" },
          { value: "15", label: "15 Minuten" },
          { value: "30", label: "30 Minuten" },
          { value: "60", label: "60 Minuten" },
        ],
      },
    ],
  },
  {
    id: "imageStudio",
    title: "Image Studio",
    description: "Bildgenerierung — lokal auf dem RTX-Host.",
    fields: [
      { group: "imageStudio", key: "enabled", label: "Image Studio aktiv", kind: "boolean" },
      {
        group: "imageStudio",
        key: "backgroundRemovalEnabled",
        label: "Hintergrund-Freistellung",
        kind: "boolean",
      },
    ],
  },
  {
    id: "storage",
    title: "Speicher",
    description: "Ablagepfade auf dem Host. Relative Pfade liegen unter dem UWE-Wurzelverzeichnis.",
    fields: [
      { group: "storage", key: "uploadsPath", label: "Uploads", kind: "text" },
      { group: "storage", key: "exportsPath", label: "Exporte", kind: "text" },
    ],
  },
  {
    id: "backup",
    title: "Backup",
    description: "Der systemd-Timer liest diese Werte aus der gesyncten schedule.json.",
    fields: [
      { group: "backup", key: "backupsPath", label: "Backup-Verzeichnis", kind: "text" },
      { group: "backup", key: "autoBackupEnabled", label: "Automatisches Backup", kind: "boolean" },
      {
        group: "backup",
        key: "retentionCount",
        label: "Aufbewahrung",
        kind: "select",
        options: [
          { value: "7", label: "7 Stück" },
          { value: "14", label: "14 Stück" },
          { value: "30", label: "30 Stück" },
        ],
      },
    ],
  },
  {
    id: "briefing",
    title: "Morgen-Briefing",
    description: "Tägliche Zusammenfassung, ausgelöst vom systemd-Timer.",
    fields: [
      { group: "briefing", key: "autoBriefingEnabled", label: "Auto-Briefing", kind: "boolean" },
      { group: "briefing", key: "time", label: "Uhrzeit (HH:MM)", kind: "text" },
    ],
  },
  {
    id: "privacy",
    title: "Privatsphäre",
    description: "Was UWE über sich selbst preisgibt.",
    fields: [
      { group: "privacy", key: "maskSecretsInUi", label: "Secrets in der Oberfläche maskieren", kind: "boolean" },
      { group: "privacy", key: "restrictPublicExport", label: "Öffentlichen Export einschränken", kind: "boolean" },
    ],
  },
  {
    id: "auth",
    title: "Anmeldung",
    description: "Sitzungen und Anmeldemethoden aller vier Bereiche.",
    fields: [
      {
        group: "auth",
        key: "sessionInactivityTimeoutMinutes",
        label: "Auto-Logout nach (Minuten)",
        kind: "number",
        hint: "0 = kein Auto-Logout.",
        min: 0,
        max: 20160,
      },
      {
        group: "auth",
        key: "passkeysEnabled",
        label: "Passkey-Login (Face ID / Touch ID / Sicherheitsschlüssel)",
        kind: "boolean",
        hint: "WebAuthn für Studio und Portal. Registrieren unter Account → Sicherheit; braucht HTTPS (oder localhost). Passkeys hängen an der Domain — nach einem Domain-Wechsel neu registrieren.",
      },
      {
        group: "auth",
        key: "googleLoginEnabled",
        label: "Google-Login",
        kind: "boolean",
        hint: "„Mit Google anmelden“ nur für bestehende Konten — es werden keine neuen angelegt. Braucht Client-ID (unten) und das Client-Secret aus der SMTP-&-Login-Karte.",
      },
      {
        group: "auth",
        key: "googleClientId",
        label: "Google Client-ID",
        kind: "text",
        hint: "Aus einem kostenlosen Google-Cloud-Projekt (APIs & Dienste → Anmeldedaten → OAuth-Client-ID, Typ Webanwendung).",
      },
    ],
  },
  {
    id: "maintenance",
    title: "Notfallmodus",
    description: "Sperrt Bereiche, ohne den Dienst anzuhalten.",
    fields: [
      { group: "maintenance", key: "maintenanceMode", label: "Wartungsmodus", kind: "boolean" },
      { group: "maintenance", key: "lockPortal", label: "Portal sperren", kind: "boolean" },
      { group: "maintenance", key: "lockStudio", label: "Studio sperren", kind: "boolean" },
      { group: "maintenance", key: "message", label: "Hinweistext", kind: "text" },
    ],
  },
];

/** Reads `settings[group][key]` from an ops payload without trusting its shape. */
export function readSettingValue(settings: unknown, field: SettingsField): unknown {
  if (!settings || typeof settings !== "object") return undefined;
  const group = (settings as Record<string, unknown>)[field.group];
  if (!group || typeof group !== "object") return undefined;
  return (group as Record<string, unknown>)[field.key];
}

/** Turns a form value back into the type the settings validator expects. */
export function coerceSettingValue(field: SettingsField, raw: string | boolean): unknown {
  if (field.kind === "boolean") return raw === true;
  if (field.kind === "number") return Number(raw);
  if (field.kind === "select") {
    const numeric = Number(raw);
    return Number.isNaN(numeric) || String(raw).trim() === "" ? raw : numeric;
  }
  if (field.kind === "textarea") {
    const text = String(raw);
    return text.trim() === "" ? null : text;
  }
  return String(raw);
}

/** Groups flat `${group}.${key}` edits back into the nested update body. */
export function buildUpdateBody(
  edits: Map<string, unknown>,
  fieldsById: Map<string, SettingsField>,
): Record<string, Record<string, unknown>> {
  const body: Record<string, Record<string, unknown>> = {};
  for (const [id, value] of edits) {
    const field = fieldsById.get(id);
    if (!field) continue;
    body[field.group] ??= {};
    body[field.group]![field.key] = value;
  }
  return body;
}
