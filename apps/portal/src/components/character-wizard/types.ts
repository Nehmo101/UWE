"use client";

/**
 * Der Vertrag zwischen Gerüst und Schritten.
 *
 * Jeder Schritt bekommt genau dasselbe Objekt: den Entwurf, die Mittel ihn
 * zu ändern, und die bereits aufgelösten Katalogeinträge. Kein Schritt holt
 * sich selbst etwas aus dem Katalog nach — sonst laufen Vorschau-Leiste und
 * Schritt auseinander, sobald jemand eine Auflösung ändert.
 */

import type {
  Background,
  CharacterDraft,
  DerivedPreview,
  DndClass,
  Species,
  SpeciesLineage,
  StepValidation,
  Subclass,
} from "@uwe/character-creator";

export interface ResolvedCatalog {
  species: Species | null;
  lineage: SpeciesLineage | null;
  dndClass: DndClass | null;
  subclass: Subclass | null;
  background: Background | null;
}

export interface StepProps {
  draft: CharacterDraft;
  /** Einzelnes Feld setzen. */
  set: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  /** Mehrere Felder auf einmal — für Entscheidungen mit Folgen. */
  patch: (changes: Partial<CharacterDraft>) => void;
  resolved: ResolvedCatalog;
  preview: DerivedPreview;
  /** Die Prüfung dieses Schritts — für Inline-Hinweise. */
  validation: StepValidation;
  /** Zu einem anderen Schritt springen (z. B. „Hintergrund zuerst wählen"). */
  goTo: (step: string) => void;
  worldSlug: string;
  /**
   * Legt den Charakter an. Bekommt den Entwurf als JSON-Zeichenkette, weil
   * Server Actions nur serialisierbare Argumente annehmen.
   */
  createAction: (payload: string) => Promise<void>;
  /** Alle Schrittprüfungen — die Übersicht listet daraus das Fehlende auf. */
  allValidations: StepValidation[];
}
