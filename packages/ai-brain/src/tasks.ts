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
  prepare_canon_check: "Kanonprüfung vorbereiten",
  prepare_next_session: "Nächste Session vorbereiten",
  create_player_handout: "Spieler-Handout erstellen",
  fill_dungeon_room: "Dungeonraum füllen",
  prepare_mail_draft: "Mail-Entwurf vorbereiten",
  atlas_name_region: "Atlas-Regionen benennen",
  atlas_describe_region: "Atlas-Region beschreiben",
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
  prepare_canon_check:
    "Bereite eine Kanonprüfung vor: Liste Abweichungen, fehlende Quellen, widersprüchliche Aussagen und Empfehlungen zur Kanonisierung.",
  prepare_next_session:
    "Bereite die nächste Session vor: Agenda, Szenen, NPCs, mögliche Encounters, offene Plot-Hooks und Vorbereitungshinweise für den Spielleiter.",
  create_player_handout:
    "Erstelle ein spielerfreundliches Handout (In-Game-Dokument oder Session-Zusammenfassung). Keine GM-Geheimnisse, keine DM-only-Inhalte.",
  fill_dungeon_room:
    "Fülle einen Dungeonraum mit Atmosphäre, Beschreibung, Interaktionen, Gefahren, Loot-Hinweisen und GM-Notizen. Passend zum bestehenden Setting.",
  prepare_mail_draft:
    "Bereite einen Mail-Entwurf für Spieler vor (Betreff + Text). Nur spieler-sichere Inhalte, keine DM-only-Geheimnisse. Keine automatische Versendung.",
  atlas_name_region:
    "Schlage stimmungsvolle, zum Weltbuilding passende Namen für die Regionen, Gebirge, Wälder, Flüsse und Städte im Atlas-Entwurf vor. Nutze den Kampagnen-Kontext für thematische Kohärenz. Gib für jede Einheit einen primären Namen und optional einen Alternativnamen an. Format: eine Zeile je Eintrag 'ID: Name (optional: Alternativname)'. Nie automatisch in den Kanon übernehmen.",
  atlas_describe_region:
    "Schreibe eine atmosphärische Beschreibung der angegebenen Kartenregion. Nutze Biom, Nachbarregionen, Flüsse, Orte und Kampagnen-Kontext. Gib eine DM-Beschreibung (2–4 Absätze) und optional einen kurzen Spieler-Flavortext. Markiere alles klar als Vorschlag — nie automatisch in den Kanon übernehmen.",
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
};

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
