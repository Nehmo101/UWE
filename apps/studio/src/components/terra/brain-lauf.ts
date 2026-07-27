import { studioApiUrl } from "@/src/lib/studio-api-url";

/**
 * Eine Brain-Aktion von der Terra-Seite aus starten und auf ihr Ergebnis warten.
 *
 * `POST /api/brain/run` legt einen Job an und antwortet sofort; der Lauf selbst
 * dauert Sekunden bis Minuten. Der Client pollt deshalb `/api/jobs/:id`, statt
 * die Verbindung offen zu halten — das ist der Weg, den `TerraEntwurfPanel`
 * seit J4 geht, und er steht jetzt hier, weil ein zweites Bedienfeld dazukommt.
 *
 * Was hier bewusst NICHT passiert: keine Rechteprüfung, keine Auswertung des
 * Inhalts. Die Route prüft die Rechte serverseitig, und was der Vorschlag
 * bedeutet, weiß nur das aufrufende Bedienfeld — der Kartenentwurf will JSON,
 * die Textaktionen wollen Prosa.
 */

/* Wie bei den übrigen Brain-Knöpfen im Studio (SessionRecapAiButton,
   PrepareSessionPanel): lokales Modell zuerst. Ein Auswahlfeld gehört in die
   AI-Einstellungen, nicht neben jedes Textfeld. */
export const TERRA_BRAIN_PROVIDER = "ollama";
export const TERRA_BRAIN_MODELL = "llama3.2";
export const TERRA_PROMPT_MAX = 2000;

const POLL_MS = 1500;
const POLL_MAX = 80; // 2 Minuten — das Provider-Zeitlimit liegt bei 120 s

interface JobAntwort {
  job?: { id?: string; status?: string; errorMessage?: string | null; result?: unknown };
  error?: string;
}

export interface BrainLaufErgebnis {
  ok: boolean;
  /** Inhalt des ersten Vorschlags — Prosa oder JSON-Text, je nach Aktion. */
  inhalt: string | null;
  /** Korrekturen, die der Validator an der Modellantwort vorgenommen hat. */
  notizen: string[];
  /** Id des Laufs, für die Rückverfolgung im KI-Protokoll. */
  laufId: string | null;
  meldung: string | null;
}

function leseVorschlag(result: unknown): { inhalt: string | null; notizen: string[] } {
  const proposals = (
    result as { proposals?: Array<{ content?: string; metadata?: Record<string, unknown> }> }
  )?.proposals;
  const erste = proposals?.[0];
  if (!erste?.content) return { inhalt: null, notizen: [] };
  const roh = erste.metadata?.notices;
  const notizen = Array.isArray(roh)
    ? roh.map((n) => {
        const eintrag = n as { path?: string; message?: string };
        return `${eintrag.path ?? "?"}: ${eintrag.message ?? ""}`.trim();
      })
    : [];
  return { inhalt: erste.content, notizen };
}

export async function starteBrainLauf(input: {
  actionId: string;
  worldSlug: string;
  userPrompt: string;
}): Promise<BrainLaufErgebnis> {
  const leer: BrainLaufErgebnis = { ok: false, inhalt: null, notizen: [], laufId: null, meldung: null };

  try {
    const antwort = await fetch(studioApiUrl("/api/brain/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId: input.actionId,
        worldSlug: input.worldSlug,
        providerId: TERRA_BRAIN_PROVIDER,
        model: TERRA_BRAIN_MODELL,
        userPrompt: input.userPrompt.slice(0, TERRA_PROMPT_MAX),
      }),
    });
    const daten = (await antwort.json()) as JobAntwort;
    if (!antwort.ok || !daten.job?.id) {
      return { ...leer, meldung: daten.error ?? "Die Brain-Aktion ließ sich nicht starten." };
    }

    let job = daten.job;
    for (
      let runde = 0;
      runde < POLL_MAX && job.status !== "completed" && job.status !== "failed";
      runde++
    ) {
      await new Promise((fertig) => setTimeout(fertig, POLL_MS));
      const stand = await fetch(studioApiUrl(`/api/jobs/${job.id}`));
      const gelesen = (await stand.json()) as JobAntwort;
      if (!stand.ok || !gelesen.job) break;
      job = gelesen.job;
    }

    if (job.status !== "completed") {
      return { ...leer, meldung: job.errorMessage ?? "Der Lauf ist nicht fertig geworden." };
    }

    const { inhalt, notizen } = leseVorschlag(job.result);
    if (!inhalt) {
      return { ...leer, meldung: "Der Lauf hat keinen Vorschlag geliefert." };
    }

    const laufId =
      typeof (job.result as { runId?: string })?.runId === "string"
        ? (job.result as { runId: string }).runId
        : null;

    return { ok: true, inhalt, notizen, laufId, meldung: null };
  } catch (fehler) {
    return {
      ...leer,
      meldung: fehler instanceof Error ? fehler.message : "Der Lauf ist fehlgeschlagen.",
    };
  }
}
