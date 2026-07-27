/**
 * 1-Klick-Presets für wiederkehrende Agent-Jobs (Backlog #Track3).
 *
 * Presets sind reine Dev-Prompt-Templates: Agent-Jobs laufen bei GitHub
 * Actions / Cursor Cloud, daher dürfen sie — wie das manuelle Formular —
 * keine Weltdaten, Brain-Inhalte oder Secrets transportieren. Kampagnen-
 * Content (NPCs, Quests, …) läuft weiterhin über die RTX-only-Generatoren
 * mit Review-Pflicht, nicht über diese Queue.
 */

export interface AgentJobPresetField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  multiline?: boolean;
}

export interface AgentJobPreset {
  id: string;
  label: string;
  summary: string;
  titleTemplate: string;
  promptTemplate: string;
  fields: AgentJobPresetField[];
}

/** Gemeinsamer Schlussblock: Branch-/Gate-/Sicherheitsregeln jedes Presets. */
const COMMON_RULES = `

Regeln:
- Genau EIN Arbeitspaket, Branch \`cursor/backlog-{{branchSlug}}-c636\`.
- Pflichtlektüre vor Start: CLAUDE.md, AGENTS.md; bei Portal-Änderungen SECURITY.md.
- Business-Logik in packages/*, dünne Next.js-Apps, minimaler Diff.
- Gate vor Push: \`pnpm ci:light\` (bei Portal-Views zusätzlich \`pnpm test:security\`).
- Commit + Push + Draft-PR mit manuellen QA-Schritten. KEIN Auto-Merge.
- Keine Weltdaten, Brain-Inhalte, Passwörter oder API-Keys verwenden.`;

const BRANCH_SLUG_FIELD: AgentJobPresetField = {
  key: "branchSlug",
  label: "Branch-Kürzel (lowercase, z. B. treasury-filtering)",
  placeholder: "mein-paket",
  required: true,
};

export const AGENT_JOB_PRESETS: AgentJobPreset[] = [
  {
    id: "backlog_package",
    label: "Backlog-Arbeitspaket umsetzen",
    summary:
      "Ein Paket aus docs/ROADMAP.md implementieren — Ist-Stand prüfen, nicht doppelt bauen.",
    titleTemplate: "feat: {{paket}}",
    promptTemplate: `Setze das Backlog-Arbeitspaket "{{paket}}" aus docs/ROADMAP.md um.

Scope/Details:
{{details}}

Prüfe zuerst den Ist-Stand im Code (Grep/Read) — die Docs können hinterherhinken; baue nichts doppelt. Beachte die gesperrten Beschlüsse in §13 des Backlog-Plans.${COMMON_RULES}`,
    fields: [
      {
        key: "paket",
        label: "Arbeitspaket (Name aus dem Backlog-Plan)",
        placeholder: "C7 Treasury Portal-Filtering",
        required: true,
      },
      {
        key: "details",
        label: "Scope / Akzeptanzkriterien",
        placeholder: "Was genau gebaut werden soll, was explizit nicht …",
        required: true,
        multiline: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
  {
    id: "bugfix",
    label: "Bug aus dem Bug Center fixen",
    summary: "Reproduzieren, Ursache finden, minimal fixen, Regressionstest.",
    titleTemplate: "fix: {{bugTitle}}",
    promptTemplate: `Fixe folgenden Bug aus dem UWE Bug Center (/bugs):

Titel: {{bugTitle}}
Beschreibung/Repro:
{{bugDetails}}

Vorgehen: Ursache im Code lokalisieren (nicht nur Symptom), minimaler Fix, Regressionstest der den Bug vor dem Fix nachstellt.${COMMON_RULES}`,
    fields: [
      {
        key: "bugTitle",
        label: "Bug-Titel",
        placeholder: "Portal: nextSession bleibt leer",
        required: true,
      },
      {
        key: "bugDetails",
        label: "Beschreibung / Repro-Schritte",
        placeholder: "Schritte, erwartetes vs. tatsächliches Verhalten …",
        required: true,
        multiline: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
  {
    id: "docs_sync",
    label: "Docs-Sync nach Merges",
    summary:
      "FEATURE_BACKLOG_PLAN, FEATURE_MATURITY_MATRIX und CURRENT_STATE an den Code-Stand angleichen.",
    titleTemplate: "docs: sync backlog docs ({{mergedPrs}})",
    promptTemplate: `Gleiche docs/ROADMAP.md, docs/FEATURE_MATURITY_MATRIX.md und docs/CURRENT_STATE.md an den aktuellen Code-Stand an. Anlass: gemergte PRs {{mergedPrs}}.

Verifiziere jeden Status per Grep/Read im Code (nicht raten), hebe Erledigtes auf ✅/Beta, aktualisiere die TL;DR-Zähler konsistent zu den Tabellen. §13-Beschlüsse nicht umformulieren. Gate: \`pnpm docs:check\`.${COMMON_RULES}`,
    fields: [
      {
        key: "mergedPrs",
        label: "Gemergte PRs (Anlass)",
        placeholder: "#401, #399",
        required: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
  {
    id: "test_hardening",
    label: "Tests härten / Flaky-Test fixen",
    summary: "Instabile oder fehlende Tests in einem Bereich stabilisieren.",
    titleTemplate: "test: {{bereich}}",
    promptTemplate: `Härte die Tests im Bereich "{{bereich}}": identifiziere flaky/fehlende Tests (Testlauf mehrfach, Logs prüfen), stabilisiere sie deterministisch (keine sleeps, keine Reihenfolge-Abhängigkeit) und ergänze fehlende Kernfälle. Keine Produktiv-Logik-Änderungen außer testbedingt nötig — dann klein und begründet.${COMMON_RULES}`,
    fields: [
      {
        key: "bereich",
        label: "Bereich / Package",
        placeholder: "packages/database tag-service",
        required: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
  {
    id: "security_check",
    label: "Portal-Leak-/Security-Check",
    summary:
      "dm_only-Filterung und Auth-Guards eines Portal-Bereichs prüfen und Lücken schließen.",
    titleTemplate: "security: portal check {{bereich}}",
    promptTemplate: `Prüfe den Portal-Bereich "{{bereich}}" auf Leaks: dm_only-Inhalte müssen server-seitig gefiltert sein (packages/database/src/permissions.ts als Referenz), Spieler dürfen nur eigene bzw. freigegebene Daten sehen/ändern. Schreibe für jede gefundene Lücke erst einen fehlschlagenden Security-Test, dann den Fix. Pflicht: \`pnpm test:security\` grün.${COMMON_RULES}`,
    fields: [
      {
        key: "bereich",
        label: "Portal-Bereich",
        placeholder: "treasury, characters, sessions …",
        required: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
  {
    id: "refactor_cleanup",
    label: "Kleiner Refactor / Cleanup",
    summary: "Eng umrissenes Aufräumpaket ohne Verhaltensänderung.",
    titleTemplate: "refactor: {{ziel}}",
    promptTemplate: `Führe folgendes eng umrissene Refactoring/Cleanup durch (KEINE Verhaltensänderung, keine Drive-by-Änderungen):

{{ziel}}

Bestehende Tests müssen unverändert grün bleiben; ergänze Charakterisierungstests, wo das Refactoring sonst ungeschützt wäre.${COMMON_RULES}`,
    fields: [
      {
        key: "ziel",
        label: "Was aufgeräumt werden soll",
        placeholder: "Dupliziertes Slug-Handling in … zusammenführen",
        required: true,
        multiline: true,
      },
      BRANCH_SLUG_FIELD,
    ],
  },
];

export function getAgentJobPreset(id: string): AgentJobPreset | undefined {
  return AGENT_JOB_PRESETS.find((preset) => preset.id === id);
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Alle im Template referenzierten Platzhalter-Keys. */
export function listPresetPlaceholders(preset: AgentJobPreset): string[] {
  const keys = new Set<string>();
  for (const template of [preset.titleTemplate, preset.promptTemplate]) {
    for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
      keys.add(match[1]!);
    }
  }
  return [...keys];
}

/**
 * Füllt Titel- und Prompt-Template eines Presets.
 * Wirft bei leeren Pflichtfeldern und bei Platzhaltern ohne Feld-Definition —
 * so kann kein halb ausgefülltes Template in der Queue landen.
 */
export function fillAgentJobPreset(
  preset: AgentJobPreset,
  values: Record<string, string>,
): { title: string; prompt: string } {
  const known = new Set(preset.fields.map((field) => field.key));
  for (const key of listPresetPlaceholders(preset)) {
    if (!known.has(key)) {
      throw new Error(`Preset "${preset.id}": Platzhalter {{${key}}} hat kein Feld.`);
    }
  }
  for (const field of preset.fields) {
    if (field.required && !(values[field.key] ?? "").trim()) {
      throw new Error(`Preset "${preset.id}": Pflichtfeld "${field.label}" fehlt.`);
    }
  }
  const substitute = (template: string) =>
    template.replace(PLACEHOLDER_PATTERN, (_, key: string) => (values[key] ?? "").trim());
  return {
    title: substitute(preset.titleTemplate),
    prompt: substitute(preset.promptTemplate),
  };
}
