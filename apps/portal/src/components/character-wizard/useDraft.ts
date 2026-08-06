"use client";

/**
 * Der Entwurf als Zustand — inklusive Überleben eines Reloads.
 *
 * Ein halb gebauter Charakter ist teuer: zehn Entscheidungen, teils
 * nachgeschlagen. Wer den Tab neu lädt und wieder bei „Volk wählen" landet,
 * macht es kein zweites Mal. Deshalb liegt der Entwurf in `sessionStorage`,
 * pro Welt getrennt, und wird beim ersten Rendern zurückgelesen.
 *
 * Bewusst `sessionStorage` und nicht `localStorage`: Der Entwurf gehört zu
 * dieser Sitzung an diesem Gerät. Ein halbes Jahr alter Entwurf, der beim
 * nächsten Besuch wieder auftaucht, ist kein Dienst, sondern eine Falle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyDraft, type CharacterDraft } from "@uwe/character-creator";

const STORAGE_PREFIX = "uwe:character-draft:";

function storageKey(worldSlug: string): string {
  return `${STORAGE_PREFIX}${worldSlug}`;
}

/**
 * Liest einen gespeicherten Entwurf zurück.
 *
 * Alles, was nicht zur erwarteten Form passt, wird verworfen statt repariert:
 * ein Entwurf aus einer älteren Version des Erstellers kann Felder
 * enthalten, die es nicht mehr gibt, und ein halb migrierter Entwurf ist
 * schlimmer als ein leerer.
 */
function readStored(worldSlug: string): CharacterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(worldSlug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const base = emptyDraft();
    const candidate = parsed as Partial<CharacterDraft>;
    // Nur bekannte Schlüssel übernehmen, Typen grob prüfen.
    return {
      ...base,
      ...candidate,
      name: typeof candidate.name === "string" ? candidate.name : base.name,
      chosenSkills: Array.isArray(candidate.chosenSkills)
        ? candidate.chosenSkills
        : base.chosenSkills,
      cantrips: Array.isArray(candidate.cantrips) ? candidate.cantrips : base.cantrips,
      spells: Array.isArray(candidate.spells) ? candidate.spells : base.spells,
      languages: Array.isArray(candidate.languages) ? candidate.languages : base.languages,
      details: { ...base.details, ...(candidate.details ?? {}) },
    };
  } catch {
    return null;
  }
}

export interface DraftHandle {
  draft: CharacterDraft;
  /** Einzelnes Feld setzen. */
  set: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  /** Mehrere Felder auf einmal — für Entscheidungen mit Folgen. */
  patch: (changes: Partial<CharacterDraft>) => void;
  reset: () => void;
  /** Wurde ein gespeicherter Entwurf gefunden? Für den Hinweis oben. */
  restored: boolean;
}

export function useDraft(worldSlug: string, initialName = ""): DraftHandle {
  const [draft, setDraft] = useState<CharacterDraft>(() => ({
    ...emptyDraft(),
    name: initialName,
  }));
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  // Erst nach dem ersten Rendern lesen — sonst weicht der Server-HTML vom
  // Client ab und React verwirft den Baum (Hydration-Fehler).
  useEffect(() => {
    const stored = readStored(worldSlug);
    if (stored) {
      setDraft(stored);
      setRestored(true);
    }
    hydrated.current = true;
  }, [worldSlug]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.sessionStorage.setItem(storageKey(worldSlug), JSON.stringify(draft));
    } catch {
      // Voller oder gesperrter Speicher darf den Ersteller nicht anhalten.
    }
  }, [draft, worldSlug]);

  const set = useCallback(
    <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const patch = useCallback((changes: Partial<CharacterDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const reset = useCallback(() => {
    setDraft({ ...emptyDraft(), name: initialName });
    setRestored(false);
    try {
      window.sessionStorage.removeItem(storageKey(worldSlug));
    } catch {
      // s. o.
    }
  }, [initialName, worldSlug]);

  return { draft, set, patch, reset, restored };
}

/** Nach dem Anlegen aufräumen, damit der nächste Charakter leer beginnt. */
export function clearStoredDraft(worldSlug: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(worldSlug));
  } catch {
    // egal
  }
}
