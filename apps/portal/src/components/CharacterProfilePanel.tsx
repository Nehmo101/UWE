"use client";

import { ALIGNMENTS, LANGUAGES } from "@uwe/character-creator";
import { deleteOwnCharacterAction, duplicateOwnCharacterAction } from "@/app/character-actions";
import { updateCharacterProfileAction } from "@/app/character-profile-actions";
import { Button, Input, Label, Textarea } from "@/src/components/ui";

interface CharacterProfilePanelProps {
  worldSlug: string;
  characterId: string;
  level: number;
  profile: {
    classes: unknown;
    species: unknown;
    background: unknown;
    features: unknown;
    bio: unknown;
  };
  canEdit: boolean;
  returnPath: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function referenceName(value: unknown): string {
  return text(record(value).name);
}

function languageKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry : text(record(entry).key)))
    .filter(Boolean);
}

function languageNames(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const names = value
    .map((entry) => (typeof entry === "string" ? entry : text(record(entry).name)))
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

const DETAIL_FIELDS = [
  ["pronouns", "Pronomen", 1],
  ["age", "Alter", 1],
  ["height", "Größe", 1],
  ["weight", "Gewicht", 1],
  ["eyes", "Augen", 1],
  ["hair", "Haare", 1],
  ["skin", "Haut", 1],
  ["appearance", "Erscheinung", 3],
  ["personality", "Persönlichkeit", 3],
  ["ideals", "Ideale", 3],
  ["bonds", "Bindungen", 3],
  ["flaws", "Makel", 3],
  ["backstory", "Hintergrundgeschichte", 7],
] as const;

export function CharacterProfilePanel(props: CharacterProfilePanelProps) {
  const firstClass = Array.isArray(props.profile.classes) ? record(props.profile.classes[0]) : {};
  const species = record(props.profile.species);
  const background = record(props.profile.background);
  const features = record(props.profile.features);
  const bio = record(props.profile.bio);
  const alignment = record(bio.alignment);
  const className = text(firstClass.name, "Nicht festgelegt");
  const subclass = text(firstClass.subclass);
  const speciesName = text(species.name, "Nicht festgelegt");
  const backgroundName = text(background.name, "Nicht festgelegt");
  const alignmentName = referenceName(bio.alignment) || text(features.alignment, "Nicht festgelegt");
  const selectedAlignmentKey = text(alignment.key);
  const selectedLanguageKeys = languageKeys(features.languages);

  return (
    <section className="auth-block">
      <h3>Herkunft und Geschichte</h3>
      <dl className="auth-character-sheet-summary">
        <div><dt>Spezies</dt><dd>{speciesName}</dd></div>
        <div><dt>Hintergrund</dt><dd>{backgroundName}</dd></div>
        <div><dt>Klasse</dt><dd>{className} {props.level}{subclass ? ` · ${subclass}` : ""}</dd></div>
        <div><dt>Gesinnung</dt><dd>{alignmentName}</dd></div>
        <div><dt>Sprachen</dt><dd>{languageNames(features.languages)}</dd></div>
      </dl>

      {props.canEdit ? (
        <form action={updateCharacterProfileAction} className="auth-note-form auth-character-sheet-form">
          <input type="hidden" name="worldSlug" value={props.worldSlug} />
          <input type="hidden" name="characterId" value={props.characterId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />

          <div className="auth-character-sheet-grid">
            <label>
              Gesinnung
              <select name="alignmentKey" defaultValue={selectedAlignmentKey}>
                <option value="">Nicht festgelegt</option>
                {ALIGNMENTS.map((entry) => <option key={entry.key} value={entry.key}>{entry.name}</option>)}
              </select>
            </label>
            <label>
              Sprachen
              <select name="languageKeys" multiple size={Math.min(8, LANGUAGES.length)} defaultValue={selectedLanguageKeys}>
                {LANGUAGES.map((entry) => <option key={entry.key} value={entry.key}>{entry.name}</option>)}
              </select>
            </label>
          </div>

          <div className="auth-character-sheet-grid">
            {DETAIL_FIELDS.slice(0, 7).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`profile-${key}`}>{label}</Label>
                <Input id={`profile-${key}`} name={key} defaultValue={text(bio[key])} maxLength={100} />
              </div>
            ))}
          </div>
          {DETAIL_FIELDS.slice(7).map(([key, label, rows]) => (
            <div key={key}>
              <Label htmlFor={`profile-${key}`}>{label}</Label>
              <Textarea id={`profile-${key}`} name={key} rows={rows} defaultValue={text(bio[key])} />
            </div>
          ))}
          <Button type="submit">Profil speichern</Button>
        </form>
      ) : null}

      {props.canEdit ? (
        <div className="mt-6 border-t border-border pt-4">
          <h4>Charakter verwalten</h4>
          <div className="flex flex-wrap gap-2">
            <form action={duplicateOwnCharacterAction}>
              <input type="hidden" name="worldSlug" value={props.worldSlug} />
              <input type="hidden" name="characterId" value={props.characterId} />
              <Button type="submit" variant="outline">Charakter duplizieren</Button>
            </form>
            <form
              action={deleteOwnCharacterAction}
              onSubmit={(event) => {
                if (!window.confirm("Charakter und verknüpfte Charakterseite endgültig löschen?")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="worldSlug" value={props.worldSlug} />
              <input type="hidden" name="characterId" value={props.characterId} />
              <input type="hidden" name="confirmation" value="CHARAKTER LOESCHEN" />
              <Button type="submit" variant="destructive">Charakter löschen</Button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}