import { formatTerraWorldDraftPromptContext } from "./proposal-validators/terra-world-draft";
import type { AiContext, AiTaskType } from "./types";

export const AI_TASK_LABELS: Record<AiTaskType, string> = {
  summarize_page: "Seite zusammenfassen",
  summarize_session: "Session zusammenfassen",
  generate_player_recap: "Spieler-Recap erstellen",
  suggest_links: "Links vorschlagen",
  suggest_backlinks: "Backlinks vorschlagen",
  detect_contradictions: "Widersprüche erkennen",
  find_open_threads: "Offene Plots erkennen",
  create_npc: "NPC-Ideen erstellen",
  create_location: "Orte erstellen",
  create_encounter: "Encounter erstellen",
  create_knowledge_text: "Wissenstext erstellen",
  improve_lore_text: "Lore verbessern",
  suggest_page_tags: "Seiten-Tags vorschlagen",
  page_ai_convert: "Seite KI-konvertieren",
  prepare_canon_check: "Kanonprüfung vorbereiten",
  prepare_next_session: "Nächste Session vorbereiten",
  draft_campaign_chapter: "Kapitel-Entwurf aus offenen Fäden",
  suggest_session_hooks: "Session-Aufhänger aus der Chronik",
  create_player_handout: "Spieler-Handout erstellen",
  fill_dungeon_room: "Dungeonraum füllen",
  prepare_mail_draft: "Mail-Entwurf vorbereiten",
  terra_name_regions: "Kartenregionen benennen",
  terra_describe_region: "Kartenregion beschreiben",
  terra_world_draft: "Terra-Karte aus Beschreibung entwerfen",
  simulate_faction: "Fraktion simulieren",
  generate_structured_npc: "NPC strukturiert generieren",
  generate_structured_quest: "Quest strukturiert generieren",
  generate_structured_item: "Item strukturiert generieren",
  answer_life_question: "Life-Brain Frage beantworten",
  synthesize_research: "Research-Report erstellen",
  summarize_mail: "Mail zusammenfassen",
  prioritize_mail: "Mail priorisieren",
  answer_mail_question: "Mail-Assistent",
  generate_briefing: "Morning Briefing erstellen",
  generate_theme_palette: "Design/Theme erstellen",
};

const TASK_INSTRUCTIONS: Record<AiTaskType, string> = {
  summarize_page:
    "Fasse die Seite prägnant für den Spielleiter zusammen. Behalte wichtige Fakten und offene Hooks bei.",
  summarize_session:
    "Fasse die Session-Inhalte strukturiert zusammen: Ereignisse, NPCs, Orte, offene Plotstränge. Nutze Session-Daten und verknüpfte Seiten.",
  generate_player_recap:
    "Schreibe ein spielerfreundliches Recap ohne GM-Geheimnisse. Keine DM-only-Informationen, keine versteckten Motivationen oder Plot-Twists.",
  suggest_links:
    "Schlage sinnvolle ausgehende Wikilinks zu bestehenden Seiten vor. Nenne Zielseiten mit ID und Begründung.",
  suggest_backlinks:
    "Schlage Seiten vor, die auf die aktuelle Seite verlinken sollten (eingehende Backlinks). Nenne Quellseiten mit ID und Begründung.",
  detect_contradictions:
    "Prüfe den Kontext auf Widersprüche zum Kanon. Liste konkrete Konflikte mit Quellen-IDs auf.",
  find_open_threads:
    "Erkenne offene Plotstränge, ungelöste Hooks und angedeutete Ereignisse. Priorisiere nach Dringlichkeit.",
  create_npc:
    "Entwirf einen neuen NPC passend zum Setting. Gib Name, Rolle, Motivation, Hooks und Spielhinweise.",
  create_location:
    "Entwirf einen neuen Ort passend zum Setting. Beschreibe Atmosphäre, NPCs, Geheimnisse und Abenteuer-Hooks.",
  create_encounter:
    "Entwirf ein Encounter-Szenario mit Setup, Gegnern/Irritationen, Taktik und möglichen Ausgängen.",
  create_knowledge_text:
    "Erstelle einen strukturierten Wissenstext aus dem Kontext. Schreibe als nutzbares Brain-Dokument mit Titel, Kurzfassung, gesicherten Fakten, offenen Fragen und klar markierten Ideen. Verändere Kanon nicht ungeprüft.",
  improve_lore_text:
    "Verbessere den Lore-Text stilistisch und strukturell, ohne Kanon-Fakten zu verändern.",
  suggest_page_tags:
    "Schlage passende Wiki-Tags für die Seite vor. Antworte NUR als JSON {\"tags\":[\"tag1\",\"tag2\"]}. Keine Kanon-Änderung.",
  page_ai_convert:
    "Konvertiere und formatiere den Seitentext einheitlich (Überschriften, Absätze, Wikilinks). Gib den vollständigen überarbeiteten Seitentext zurück — nur den Text, keine Meta-Kommentare.",
  prepare_canon_check:
    "Bereite eine Kanonprüfung vor: Liste Abweichungen, fehlende Quellen, widersprüchliche Aussagen und Empfehlungen zur Kanonisierung.",
  prepare_next_session:
    "Bereite die nächste Session vor: Agenda, Szenen, NPCs, mögliche Encounters, offene Plot-Hooks und Vorbereitungshinweise für den Spielleiter.",
  draft_campaign_chapter:
    "Entwirf das nächste Kapitel (Story-Bogen) der Kampagne aus dem Kampagnen-Digest im Kontext: offene Quests, jüngste Chronik, Fraktions-Agenden und der Stand der bisherigen Kapitel. Beginne zwingend mit einer Markdown-Überschrift '# <Kapiteltitel>' — sie wird beim Übernehmen zum Seitentitel. Danach: eine Kurzfassung (2–3 Sätze), die Ziele des Kapitels, 3–5 Szenen oder Stationen mit je einem Absatz, und ein Abschnitt 'Offene Fäden', der aufgegriffene Quests und Fraktionen benennt. Erfinde keine neuen Kanon-Fakten als gesichert — alles ist Vorschlag und wird erst per Review übernommen.",
  suggest_session_hooks:
    "Schlage 3–5 konkrete Einstiegs-Aufhänger für den nächsten Spielabend vor, abgeleitet aus der jüngsten Chronik, den offenen Quests und den Fraktions-Agenden im Kampagnen-Digest. Nummerierte Liste; je Aufhänger 2–3 Sätze: die Ausgangsszene, was die Gruppe unmittelbar tun kann, und welcher offene Faden daran hängt. Keine Kanon-Änderungen — die Aufhänger sind Vorbereitungsmaterial für den Spielleiter.",
  create_player_handout:
    "Erstelle ein spielerfreundliches Handout (In-Game-Dokument oder Session-Zusammenfassung). Keine GM-Geheimnisse, keine DM-only-Inhalte.",
  fill_dungeon_room:
    "Fülle einen Dungeonraum mit Atmosphäre, Beschreibung, Interaktionen, Gefahren, Loot-Hinweisen und GM-Notizen. Passend zum bestehenden Setting.",
  prepare_mail_draft:
    "Bereite einen Mail-Entwurf für Spieler vor (Betreff + Text). Nur spieler-sichere Inhalte, keine DM-only-Geheimnisse. Keine automatische Versendung.",
  terra_name_regions:
    "Schlage stimmungsvolle, zum Weltenbau passende Namen für die Regionen, Gebirge, Wälder, Flüsse und Orte der beschriebenen Karte vor. Nutze den Kampagnen-Kontext für thematische Kohärenz. Gib für jede Einheit einen primären Namen und optional einen Alternativnamen an. Format: eine Zeile je Eintrag 'Element: Name (Alternative)'. Erfinde keine Elemente hinzu, die nicht genannt wurden. Nie automatisch in den Kanon übernehmen.",
  terra_describe_region:
    "Schreibe eine atmosphärische Beschreibung des angegebenen Kartenausschnitts. Nutze Biom, Nachbarregionen, Flüsse, Orte und Kampagnen-Kontext. Gib eine DM-Beschreibung (2–4 Absätze) und optional einen kurzen Spieler-Flavortext. Markiere alles klar als Vorschlag — nie automatisch in den Kanon übernehmen.",
  terra_world_draft:
    "Übersetze die Beschreibung des Nutzers in GENERATOR-PARAMETER für Terra und antworte NUR mit dem JSON-Objekt aus dem folgenden Pflichtkontext. " +
    "Du lieferst das WAS (Biom, Kartengröße, Maßstab, Klima, Relief-Wunsch, Anzahl von Flüssen/Siedlungen/Wäldern/Wiesen/Ranken, Stimmung, Namen) — " +
    "das WIE (Koordinaten, Punktlisten, Höhen, Platzierung) macht Terras deterministischer Weltgenerator. " +
    "Liefere niemals Koordinaten, Polygone, Höhendaten, Elemente oder Code. Alles, was du weglässt, füllt Terra aus seinen Vorgaben.\n\n" +
    formatTerraWorldDraftPromptContext(),
  simulate_faction:
    "Simuliere einen Zeitsprung für die Fraktion im Kontext: Welche Ereignisse, Ressourcen- und Beziehungsänderungen ergeben sich? Antworte NUR als JSON-Objekt {\"events\":[...]} — jedes Event mit title, inGameDate {year,month,day}, summaryPlayer, summaryDm (optional), visibility (player_visible|private|dm_only). Keine Kanon-Änderungen ohne Review.",
  generate_structured_npc:
    "Generiere strukturierte NPC-Inhalte aus den Vorgaben. Antworte NUR als JSON {\"fields\":{...},\"summary\":\"optional\",\"playerText\":\"optional\"}. Felder: voice, motivation, relationship, plotHook, secret. Keine Kanon-Änderung ohne Review.",
  generate_structured_quest:
    "Generiere strukturierte Quest-Inhalte. Antworte NUR als JSON {\"fields\":{...},\"summary\":\"optional\",\"playerText\":\"optional\"}. Felder: patron, objective, twist, failure, reward.",
  generate_structured_item:
    "Generiere strukturierte Item-Inhalte. Antworte NUR als JSON {\"fields\":{...},\"summary\":\"optional\",\"playerText\":\"optional\"}. Felder: rarity, properties, value, curse, lore.",
  answer_life_question:
    "Beantworte die Frage aus dem persönlichen Life-Brain-Kontext. Stütze dich nur auf den bereitgestellten Kontext und allgemeines Wissen. Wenn der Kontext die Antwort nicht hergibt, sage das klar, statt etwas zu erfinden.",
  synthesize_research:
    "Fasse die mitgelieferten Web-Quellen zu einem strukturierten Recherche-Report zusammen: Kurzantwort, Erkenntnisse mit Quellenverweisen [n], offene Fragen. Erfinde keine Fakten und keine Quellen.",
  summarize_mail:
    "Fasse die E-Mail in 2–3 Sätzen auf Deutsch zusammen. Keine erfundenen Details.",
  prioritize_mail:
    "Bewerte die E-Mail nach Priorität und Kategorie. Antworte NUR als JSON.",
  answer_mail_question:
    "Beantworte Fragen zur E-Mail und schlage verwaltbare Aktionen vor (löschen, abmelden, archivieren). Führe nichts automatisch aus.",
  generate_briefing:
    "Erstelle ein kompaktes Morning Briefing auf Deutsch (Markdown): 1. Das Wichtigste heute (2–3 Sätze), 2. Termine & Fristen, 3. Offene Aufgaben & Warnungen, 4. Nachrichtenlage in 3–4 Stichpunkten. Nutze nur die mitgelieferten Fakten und News-Schlagzeilen — erfinde nichts.",
  generate_theme_palette:
    "Entwirf UI-Farbpaletten als striktes JSON. Stelle bei Bedarf kurze Rückfragen; sonst liefere Paletten-Kandidaten. Antworte NUR mit dem vereinbarten JSON-Objekt.",
};

/**
 * Tasks whose ANSWER must be a JSON object, not prose.
 *
 * This is the switch behind the whole JSON story: the router asks the provider
 * for protocol-level JSON only for these, and only for these does a failed
 * parse buy a second attempt. Everything else is prose and must stay prose —
 * forcing `response_format: json_object` onto a session recap would produce a
 * quoted blob instead of a summary.
 *
 * The list is kept honest by `tasks.test.ts`: every entry's instruction has to
 * contain the JSON demand in words, and every instruction that demands JSON in
 * words has to be listed here. Adding a JSON task and forgetting this list is
 * exactly the mistake that made structured output unreliable before.
 */
export const JSON_RESULT_TASKS: readonly AiTaskType[] = [
  "suggest_page_tags",
  "terra_world_draft",
  "simulate_faction",
  "generate_structured_npc",
  "generate_structured_quest",
  "generate_structured_item",
  "prioritize_mail",
  "generate_theme_palette",
] as const;

const JSON_RESULT_TASK_SET = new Set<AiTaskType>(JSON_RESULT_TASKS);

export function requiresJsonResult(taskType: AiTaskType): boolean {
  return JSON_RESULT_TASK_SET.has(taskType);
}

/**
 * The wording that marks an instruction as a JSON contract. Used by the test
 * that keeps {@link JSON_RESULT_TASKS} and {@link TASK_INSTRUCTIONS} together;
 * exported so the test does not have to re-guess the phrasing.
 */
export const JSON_INSTRUCTION_MARKERS = [
  "NUR als JSON",
  "NUR mit dem JSON",
  "NUR mit dem vereinbarten JSON",
] as const;

export function instructionDemandsJson(taskType: AiTaskType): boolean {
  const instruction = TASK_INSTRUCTIONS[taskType];
  return JSON_INSTRUCTION_MARKERS.some((marker) => instruction.includes(marker));
}

/** Tasks that run on personal Life-Brain context — prompt heading differs from campaigns. */
const LIFE_BRAIN_TASKS: AiTaskType[] = ["answer_life_question", "generate_briefing"];

/** Tasks that run on either brain — neutral framing instead of campaign wording. */
const CONTEXT_NEUTRAL_TASKS: AiTaskType[] = ["synthesize_research"];

function resolveContextHeading(taskType: AiTaskType): string {
  if (LIFE_BRAIN_TASKS.includes(taskType)) return "Life-Brain-Kontext:";
  if (CONTEXT_NEUTRAL_TASKS.includes(taskType)) return "Kontext:";
  return "Kampagnen-Kontext:";
}

export function buildTaskPrompt(taskType: AiTaskType, context: AiContext, userPrompt?: string): string {
  const instruction = TASK_INSTRUCTIONS[taskType];
  const contextHeading = resolveContextHeading(taskType);
  const parts = [
    `Aufgabe: ${AI_TASK_LABELS[taskType]}`,
    instruction,
    "",
    contextHeading,
    context.promptContext,
    "",
    "Quellen:",
    ...context.sources.map((s) => {
      const parts = [`Seite ${s.pageId}`];
      if (s.blockIds?.length) parts.push(`Blöcke: ${s.blockIds.join(", ")}`);
      if (s.brainEntryId) parts.push(`Brain: ${s.brainEntryId}`);
      return `- ${parts.join(" — ")}`;
    }),
  ];

  if (context.sessionId) {
    parts.push("", `Session-ID: ${context.sessionId}`);
  }

  if (userPrompt?.trim()) {
    parts.push(
      "",
      LIFE_BRAIN_TASKS.includes(taskType) ? "Frage:" : "Zusätzliche Anweisung:",
      userPrompt.trim(),
    );
  }

  parts.push(
    "",
    LIFE_BRAIN_TASKS.includes(taskType) || CONTEXT_NEUTRAL_TASKS.includes(taskType)
      ? "Wichtig: Erfinde keine Fakten. Wenn der Kontext keine Antwort hergibt, sage das klar."
      : "Wichtig: Erfinde keine Fakten ohne Kennzeichnung. Markiere Vorschläge klar als Idee, nicht als Kanon.",
  );

  return parts.join("\n");
}

export function buildTaskSystemPrompt(taskType: AiTaskType): string {
  const playerSafe = [
    "generate_player_recap",
    "create_player_handout",
    "prepare_mail_draft",
  ].includes(taskType);
  const extra = playerSafe
    ? " Enthülle niemals GM-Geheimnisse, DM-only-Inhalte oder versteckte Plot-Twists."
    : "";

  if (LIFE_BRAIN_TASKS.includes(taskType)) {
    return [
      "Du bist der lokale AI-Assistent für das persönliche Life-Brain in UWE.",
      `Aktuelle Aufgabe: ${AI_TASK_LABELS[taskType]}.`,
      "Antworte auf Deutsch, klar und hilfreich.",
      "Der Kontext ist privates Wissen des Nutzers — er verlässt niemals das lokale System.",
    ].join(" ");
  }

  if (CONTEXT_NEUTRAL_TASKS.includes(taskType)) {
    return [
      "Du bist der Recherche-Assistent von UWE.",
      `Aktuelle Aufgabe: ${AI_TASK_LABELS[taskType]}.`,
      "Antworte auf Deutsch als sauber strukturiertes Markdown.",
      "Belege Aussagen mit den nummerierten Quellenverweisen [n] und erfinde keine Quellen.",
    ].join(" ");
  }

  return [
    "Du bist der AI-Assistent des Universellen Welten-Editors (UWE) für Pen-&-Paper-Kampagnen.",
    `Aktuelle Aufgabe: ${AI_TASK_LABELS[taskType]}.`,
    "Antworte auf Deutsch, präzise und für Tabletop-RPGs nutzbar.",
    "Verwende die mitgelieferten Quellen-IDs, wenn du dich auf Inhalte beziehst.",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
