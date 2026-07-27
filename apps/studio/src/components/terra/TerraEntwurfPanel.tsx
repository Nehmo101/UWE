"use client";

import { useCallback, useMemo, useState } from "react";
import {
  TERRA_BIOME,
  TERRA_KARTEN_GROESSEN,
  TERRA_MAX,
  TERRA_SPRACHFAMILIEN,
  TERRA_TAGESZEITEN,
  TERRA_WETTER,
  TERRA_WORLD_DRAFT_STANDARD,
  validateTerraWorldDraft,
} from "@uwe/ai-brain/proposal-validators";
import type { TerraWorldDraft } from "@uwe/ai-brain/proposal-validators";
import { starteBrainLauf, TERRA_PROMPT_MAX } from "./brain-lauf";

/**
 * „Karte beschreiben" (J4) — die Bedienung der KI-Vorgenerierung.
 *
 * Ein Eingabefeld, ein Knopf, ein sichtbares Ergebnis. Dazwischen liegt
 * bewusst EIN Zwischenschritt: die abgeleiteten Parameter stehen sichtbar und
 * änderbar da, bevor gebaut wird. So sieht man, was das Modell verstanden
 * hat, und korrigiert eine Zahl, statt dreimal neu zu prompten.
 *
 * Die Arbeitsteilung, die diese Komponente nicht bricht:
 *   - Der Frame spricht NIE selbst zur Datenbank oder zum Modell. Diese Seite
 *     ruft die Brain-Aktion, diese Seite schickt das Ergebnis über die
 *     postMessage-Brücke hinein.
 *   - Das Modell liefert PARAMETER, nie Geometrie. Was hier ankommt, ist
 *     bereits durch `validateTerraWorldDraft` gelaufen (serverseitig, in
 *     `buildProposalsFromResult`); dieselbe Prüfung läuft hier nach jeder
 *     Änderung im Formular noch einmal, und ein drittes Mal im Frame
 *     (`pruefeVorgabe` in terra/src/generators/welt-vorgabe.js).
 *   - Die Rückfrage vor dem Überschreiben stellt der FRAME, nicht diese
 *     Seite: nur er weiß, wie viele Elemente auf der Karte stehen.
 *
 * Der Prompt geht an die Brain-Aktion und wird dort mit dem Lauf gespeichert
 * (`AiRun.userPrompt`, unter den vorhandenen Rechten). In die Karte wandert er
 * NICHT — Begründung in terra/src/generators/welt-vorgabe.js.
 */

export interface TerraEntwurfPanelProps {
  worldSlug: string;
  /** Schickt die geprüfte Vorgabe in den Frame. Liefert false, wenn der
   *  Frame (noch) nicht erreichbar ist. */
  sende: (vorgabe: TerraWorldDraft, opt: { laufId: string | null; seed: number | null }) => boolean;
  /** Ergebnis der letzten Erzeugung, vom Frame gemeldet. */
  ergebnis: TerraEntwurfErgebnis | null;
}

export interface TerraEntwurfErgebnis {
  ok: boolean;
  bericht?: {
    elemente?: number;
    fluesse?: number;
    siedlungen?: number;
    namen?: number;
    freieNamen?: number;
    region?: string | null;
    seed?: number;
    kartenGroesse?: number;
    biom?: string;
  } | null;
  hinweise?: string[];
  meldung?: string | null;
}

const PROMPT_MAX = TERRA_PROMPT_MAX;

type Lage = "ruhe" | "fragt" | "entwurf" | "baut" | "fehler";

const eingabe =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm text-foreground";

export function TerraEntwurfPanel({ worldSlug, sende, ergebnis }: TerraEntwurfPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [lage, setLage] = useState<Lage>("ruhe");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<TerraWorldDraft | null>(null);
  const [notizen, setNotizen] = useState<string[]>([]);
  const [laufId, setLaufId] = useState<string | null>(null);
  const [seed, setSeed] = useState("");

  /** Jede Änderung im Formular läuft durch denselben Validator wie die
   *  Modellantwort — ein von Hand eingetragener Unsinn kommt nicht weiter
   *  als einer aus dem Modell. */
  const setzeFeld = useCallback((teil: Partial<TerraWorldDraft>) => {
    setEntwurf((alt) => {
      const geprueft = validateTerraWorldDraft({ ...(alt ?? TERRA_WORLD_DRAFT_STANDARD), ...teil });
      return geprueft.ok ? geprueft.draft : alt;
    });
  }, []);

  const holen = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setLage("fragt");
    setMeldung(null);
    setNotizen([]);
    setEntwurf(null);
    setLaufId(null);

    /* Anlegen, pollen, ersten Vorschlag lesen — das macht `starteBrainLauf`
       für beide Terra-Bedienfelder. Hier bleibt nur, was diese Aktion
       ausmacht: die Antwort ist JSON und muss durch den Validator. */
    const lauf = await starteBrainLauf({
      actionId: "terra_world_draft",
      worldSlug,
      userPrompt: text,
    });
    if (!lauf.ok || !lauf.inhalt) {
      setLage("fehler");
      setMeldung(lauf.meldung ?? "Der Entwurf ist fehlgeschlagen.");
      return;
    }

    let geparst: unknown = null;
    try {
      geparst = JSON.parse(lauf.inhalt);
    } catch {
      geparst = null;
    }
    const geprueft = validateTerraWorldDraft(geparst);
    if (!geprueft.ok) {
      setLage("fehler");
      setMeldung(
        "Die Antwort des Modells war kein brauchbarer Parametersatz: " +
          geprueft.errors.map((f) => `${f.path} ${f.message}`).join("; "),
      );
      return;
    }
    setEntwurf(geprueft.draft);
    setNotizen([...lauf.notizen, ...geprueft.notices.map((n) => `${n.path}: ${n.message}`)]);
    setLaufId(lauf.laufId);
    setLage("entwurf");
  }, [prompt, worldSlug]);

  const bauen = useCallback(() => {
    if (!entwurf) return;
    setLage("baut");
    setMeldung(null);
    if (!sende(entwurf, { laufId, seed: seedAusText(seed) })) {
      setLage("fehler");
      setMeldung("Der Editor antwortet nicht — bitte die Seite neu laden.");
    }
  }, [entwurf, laufId, seed, sende]);

  const zusammenfassung = useMemo(() => {
    if (!ergebnis) return null;
    if (!ergebnis.ok) {
      return ergebnis.meldung === "abgebrochen"
        ? "Abgebrochen — die Karte ist unverändert."
        : `Nicht gebaut: ${ergebnis.meldung ?? "unbekannter Grund"}`;
    }
    const b = ergebnis.bericht ?? {};
    return [
      `${b.elemente ?? 0} Elemente`,
      `${b.fluesse ?? 0} Flüsse`,
      `${b.siedlungen ?? 0} Siedlungen`,
      b.region ? `„${b.region}"` : null,
      `Seed ${b.seed ?? "?"}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [ergebnis]);

  return (
    <section className="terra-entwurf" aria-label="Karte beschreiben">
      <label className="terra-entwurf-feld">
        <span>Karte beschreiben</span>
        <textarea
          value={prompt}
          maxLength={PROMPT_MAX}
          rows={3}
          placeholder="Raue Küstenregion, drei Fischerdörfer, Gebirge im Norden, Fluss von Ost nach West, spätherbstliche Stimmung"
          onChange={(e) => setPrompt(e.target.value)}
          disabled={lage === "fragt" || lage === "baut"}
          data-testid="terra-entwurf-prompt"
        />
      </label>

      <div className="terra-entwurf-zeile">
        <button
          type="button"
          onClick={() => void holen()}
          disabled={!prompt.trim() || lage === "fragt" || lage === "baut"}
          data-testid="terra-entwurf-holen"
        >
          {lage === "fragt" ? "fragt das Modell …" : "Parameter vorschlagen"}
        </button>
        <label>
          Seed
          <input
            className={eingabe}
            value={seed}
            inputMode="numeric"
            placeholder="wie gehabt"
            onChange={(e) => setSeed(e.target.value.replace(/[^-\d]/g, "").slice(0, 11))}
          />
        </label>
      </div>

      {meldung && (
        <p className="terra-entwurf-meldung" role="status" data-testid="terra-entwurf-meldung">
          {meldung}
        </p>
      )}

      {entwurf && (
        <div className="terra-entwurf-vorschau" data-testid="terra-entwurf-vorschau">
          <p className="terra-entwurf-hinweis">
            Das Modell schlägt vor. Änderbar, bevor gebaut wird — der Generator setzt
            danach die Regeln durch (kein Dorf im Wasser, keine Straße über den Steilhang).
          </p>

          <div className="terra-entwurf-gitter">
            <label>
              Biom
              <select className={eingabe} value={entwurf.biom} onChange={(e) => setzeFeld({ biom: e.target.value as TerraWorldDraft["biom"] })}>
                {TERRA_BIOME.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Kartengröße
              <select
                className={eingabe}
                value={entwurf.kartenGroesse}
                onChange={(e) => setzeFeld({ kartenGroesse: Number(e.target.value) as TerraWorldDraft["kartenGroesse"] })}
              >
                {TERRA_KARTEN_GROESSEN.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              Meter je Zelle
              <input
                className={eingabe}
                type="number"
                min={0.01}
                max={5000}
                value={entwurf.einheitMeter}
                onChange={(e) => setzeFeld({ einheitMeter: Number(e.target.value) })}
              />
            </label>
            {(["fluesse", "siedlungen", "waelder", "wiesen", "ranken"] as const).map((feld) => (
              <label key={feld}>
                {feld}
                <input
                  className={eingabe}
                  type="number"
                  min={0}
                  max={TERRA_MAX[feld]}
                  value={entwurf[feld]}
                  onChange={(e) => setzeFeld({ [feld]: Number(e.target.value) } as Partial<TerraWorldDraft>)}
                />
              </label>
            ))}
            <label>
              Sprachfamilie
              <select
                className={eingabe}
                value={entwurf.sprachfamilie}
                onChange={(e) => setzeFeld({ sprachfamilie: e.target.value as TerraWorldDraft["sprachfamilie"] })}
              >
                {TERRA_SPRACHFAMILIEN.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Tageszeit
              <select className={eingabe} value={entwurf.tageszeit} onChange={(e) => setzeFeld({ tageszeit: e.target.value as TerraWorldDraft["tageszeit"] })}>
                {TERRA_TAGESZEITEN.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Wetter
              <select className={eingabe} value={entwurf.wetter} onChange={(e) => setzeFeld({ wetter: e.target.value as TerraWorldDraft["wetter"] })}>
                {TERRA_WETTER.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
            <label>
              Gebirge Richtung °
              <input
                className={eingabe}
                type="number"
                value={entwurf.relief.richtung}
                onChange={(e) => setzeFeld({ relief: { ...entwurf.relief, richtung: Number(e.target.value) } })}
              />
            </label>
            <label>
              Gebirge Stärke
              <input
                className={eingabe}
                type="number"
                step={0.1}
                min={0}
                max={1}
                value={entwurf.relief.staerke}
                onChange={(e) => setzeFeld({ relief: { ...entwurf.relief, staerke: Number(e.target.value) } })}
              />
            </label>
          </div>

          {entwurf.namen.region && <p>Region: &bdquo;{entwurf.namen.region}&ldquo;</p>}
          {entwurf.namen.orte.length > 0 && <p>Orte: {entwurf.namen.orte.join(", ")}</p>}
          {entwurf.notizen && <p className="terra-entwurf-hinweis">{entwurf.notizen}</p>}

          {notizen.length > 0 && (
            <details className="terra-entwurf-notizen">
              <summary>{notizen.length} Korrekturen an der Modellantwort</summary>
              <ul>
                {notizen.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          )}

          <button type="button" onClick={bauen} disabled={lage === "baut"} data-testid="terra-entwurf-bauen">
            {lage === "baut" ? "baut …" : "Karte erzeugen"}
          </button>
        </div>
      )}

      {zusammenfassung && (
        <p className="terra-entwurf-ergebnis" role="status" data-testid="terra-entwurf-ergebnis">
          {zusammenfassung}
        </p>
      )}

      {ergebnis?.ok && (ergebnis.hinweise?.length ?? 0) > 0 && (
        <details className="terra-entwurf-notizen">
          <summary>{ergebnis.hinweise?.length} Hinweise aus dem Editor</summary>
          <ul>
            {ergebnis.hinweise?.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Der Seed aus dem Formular, oder null für „wie gehabt" (dann behält der
 *  Editor S.worldSeed). Nur Ziffern — ein Wort als Seed ist Terras eigener
 *  Weg im Seed-Feld des Editors, nicht der dieser Bedienung. */
function seedAusText(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null;
  const zahl = Number.parseInt(text.trim(), 10);
  return Number.isFinite(zahl) ? zahl | 0 : null;
}
