/**
 * Der KI-Feinschliff — die einzige Stelle des Packages, die den AI-Router sieht.
 *
 * Deshalb liegt sie hinter dem eigenen Einstiegspunkt `@uwe/doc-import/ai`,
 * genau wie der Schreibpfad hinter `@uwe/doc-import/writer`: Der Hauptindex
 * bleibt rein und damit ohne Datenbank und ohne Maschinenraum testbar.
 *
 * **Lokal oder gar nicht.** `providerMode: "local_engine"` ist keine Vorliebe,
 * sondern die Hausregel: Weltinhalte verlassen die eigene Hardware nicht. Ist
 * der Host stumm, wirft diese Funktion nicht — sie meldet es und gibt leere
 * Hinweise zurück. Der Import läuft dann vollständig auf Regeln, und das
 * Ergebnis ist eine gute Vorbelegung statt einer perfekten; ein Abbruch wäre
 * an dieser Stelle die schlechtere Antwort.
 *
 * **Die KI ordnet ein, sie schreibt nicht.** Sie bekommt Überschriften und
 * Anreißer und liefert Rollen zu vorhandenen Pfaden zurück. Alles, was nicht
 * auf einen bekannten Abschnitt zeigt, fällt in `parseOutlineHints` weg — ein
 * Modell kann diesem Import keine Inhalte hinzufügen.
 */

import { AiRouterError, isEngineReady, routeAiRequest, type AiRouterDeps } from "@uwe/ai-brain";
import { buildDocumentTree } from "./doc-tree";
import { parseDocument } from "./dialect";
import { DOC_PROFILE_LABELS } from "./profiles";
import { buildOutlinePrompt, parseOutlineHints } from "./semantic/ai-hints";
import { restructureDocument } from "./semantic/restructure";
import { buildKnownEntityIndex, selectMentionedEntities, type KnownEntity } from "./semantic/world-context";
import type { DocProfile, SectionRole } from "./types";

/** So viele Abschnitte gehen in eine Anfrage — darüber wird geteilt. */
const OUTLINE_CHUNK = 120;
const MAX_CHUNKS_PER_FILE = 6;

export type OutlineHintDeps = AiRouterDeps;

export interface CollectRoleHintsOptions {
  profile: DocProfile;
  files: Array<{ fileName: string; content: string }>;
  /**
   * Was die Zielwelt schon kennt. Geht **gefiltert** in die Anfrage: nur die
   * Namen, die im jeweiligen Dokument tatsächlich vorkommen — eine Welt mit
   * tausend Seiten passt sonst weder in die Anfrage noch in den Nutzen.
   */
  knownEntities?: KnownEntity[];
  /** Name der Zielwelt, damit das Modell weiß, worin es einordnet. */
  worldName?: string;
  /** Nur für Entwicklungsläufe: antwortet ein Mock statt des Hosts. */
  useMock?: boolean;
  /** Wird für jede Datei aufgerufen, sobald sie durch ist. */
  onProgress?: (done: number, total: number) => void | Promise<void>;
}

export interface CollectRoleHintsResult {
  /** Dateiname → (Dokumentpfad → Rolle). */
  hints: Map<string, Map<string, SectionRole>>;
  /** Wie viele Zuordnungen die KI beigesteuert hat. */
  applied: number;
  /** Leer, wenn alles glattging — sonst der Grund, warum es ohne KI weiterging. */
  warnings: string[];
  /** Hat der Maschinenraum-Host überhaupt geantwortet? */
  used: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Holt die Rollen-Hinweise für alle Dateien eines Laufs.
 *
 * Der erste Durchlauf ist derselbe deterministische Umbau wie im Import: Er
 * liefert die Gliederung mitsamt den Rollen, die die Regeln vergeben hätten.
 * Die KI sieht also, was ohne sie herauskäme, und muss nur widersprechen, wo es
 * falsch ist.
 */
export async function collectRoleHints(
  deps: OutlineHintDeps,
  options: CollectRoleHintsOptions,
): Promise<CollectRoleHintsResult> {
  const result: CollectRoleHintsResult = {
    hints: new Map(),
    applied: 0,
    warnings: [],
    used: false,
  };

  if (!(await isEngineReady({ useMock: options.useMock === true }))) {
    result.warnings.push(
      "Der lokale Maschinenraum ist nicht erreichbar — die Zuordnung läuft allein über die Regeln.",
    );
    return result;
  }

  const total = options.files.length;
  let done = 0;

  // Derselbe Index, den auch der Umbau benutzt — die Regeln und die KI sollen
  // dieselbe Welt sehen, sonst widersprechen sie einander.
  const known = options.knownEntities?.length
    ? buildKnownEntityIndex(options.knownEntities)
    : undefined;

  for (const file of options.files) {
    const parsed = parseDocument(file.content);
    const { outline } = restructureDocument(buildDocumentTree(parsed.body, { maxDepth: 6 }), {
      profile: options.profile,
      knownEntities: known,
    });

    const mentioned = selectMentionedEntities(options.knownEntities ?? [], parsed.body).map(
      (entity) => ({ title: entity.title, type: entity.type as string }),
    );

    if (outline.length === 0) {
      done += 1;
      await options.onProgress?.(done, total);
      continue;
    }

    const fileHints = new Map<string, SectionRole>();
    const batches = chunk(outline, OUTLINE_CHUNK).slice(0, MAX_CHUNKS_PER_FILE);

    for (const batch of batches) {
      try {
        const routed = await routeAiRequest(deps, {
          providerMode: "local_engine",
          contextMode: "general_chat",
          taskType: "create_knowledge_text",
          userPrompt: buildOutlinePrompt(batch, {
            profileLabel: DOC_PROFILE_LABELS[options.profile],
            documentTitle: outline[0]?.title ?? file.fileName,
            ...(options.worldName ? { worldName: options.worldName } : {}),
            knownEntities: mentioned,
          }),
          useMock: options.useMock === true,
          maxTokens: 4_096,
        });

        for (const [path, role] of parseOutlineHints(routed.result.text, batch)) {
          fileHints.set(path, role);
        }
        result.used = true;
      } catch (error) {
        result.warnings.push(
          error instanceof AiRouterError
            ? `${file.fileName}: Der lokale Maschinenraum hat nicht geantwortet — die Regeln entscheiden.`
            : `${file.fileName}: KI-Feinschliff übersprungen (${error instanceof Error ? error.message : "unbekannter Fehler"}).`,
        );
        break;
      }
    }

    if (fileHints.size > 0) {
      result.hints.set(file.fileName, fileHints);
      result.applied += fileHints.size;
    }

    done += 1;
    await options.onProgress?.(done, total);
  }

  return result;
}
