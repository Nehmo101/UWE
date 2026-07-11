"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterSpellView, SpellSlotSummary } from "@uwe/database/server";

export interface SpellSearchResult {
  id: string;
  name: string;
  url?: string;
  spellLevel: number;
  school?: string | null;
  description?: string;
}

const BTN_SMALL_PRIMARY =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const FIELD_LABEL = "flex flex-col gap-1 text-sm font-medium text-foreground";

const NATIVE_INPUT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface CharacterSpellSectionProps {
  spells: CharacterSpellView[];
  spellSlots: SpellSlotSummary;
  canEdit: boolean;
  hiddenFields: Record<string, string>;
  addSpellAction: (formData: FormData) => void | Promise<void>;
  removeSpellAction: (formData: FormData) => void | Promise<void>;
  togglePreparedAction: (formData: FormData) => void | Promise<void>;
  addHomebrewSpellAction: (formData: FormData) => void | Promise<void>;
  importSpellsByLevelAction?: (formData: FormData) => void | Promise<void>;
  searchSpellsUrl?: string;
  searchSpellsAction?: (query: string) => Promise<SpellSearchResult[]>;
}


function SpellLevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-border px-2 py-0.5 text-xs font-medium text-foreground">
      {level === 0 ? "Zaubertrick" : `Grad ${level}`}
    </span>
  );
}

export function CharacterSpellSection({
  spells,
  spellSlots,
  canEdit,
  hiddenFields,
  addSpellAction,
  removeSpellAction,
  togglePreparedAction,
  addHomebrewSpellAction,
  importSpellsByLevelAction,
  searchSpellsUrl,
  searchSpellsAction,
}: CharacterSpellSectionProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpellSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const preparedCount = useMemo(() => spells.filter((spell) => spell.prepared).length, [spells]);
  const slotLevels = useMemo(
    () => Object.keys(spellSlots.byLevel).map(Number).sort((a, b) => a - b),
    [spellSlots.byLevel],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!canEdit || trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      setSearchError(null);
      try {
        if (searchSpellsAction) {
          setResults(await searchSpellsAction(trimmed));
        } else if (searchSpellsUrl) {
          const response = await fetch(`${searchSpellsUrl}?q=${encodeURIComponent(trimmed)}`);
          const data = (await response.json()) as {
            results?: SpellSearchResult[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error ?? "Zaubersuche fehlgeschlagen.");
          }
          setResults(data.results ?? []);
        } else {
          setResults([]);
        }
      } catch (error) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Zaubersuche fehlgeschlagen.");
      } finally {
        setSearchBusy(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [canEdit, query, searchSpellsAction, searchSpellsUrl]);

  function renderHiddenFields() {
    return Object.entries(hiddenFields).map(([name, value]) => (
      <input key={name} type="hidden" name={name} value={value} />
    ));
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-semibold tracking-tight">Zauber</h3>
      <p className="m-0 text-sm text-muted-foreground">
        {preparedCount} vorbereitet · Zaubergrad-Slots (Caster-Level {spellSlots.casterLevel})
      </p>

      {slotLevels.length > 0 ? (
        <dl className="m-0 flex flex-wrap gap-2">
          {slotLevels.map((level) => (
            <div
              key={level}
              className="flex items-baseline gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-sm"
            >
              <dt className="text-xs text-muted-foreground">Grad {level}</dt>
              <dd className="m-0 font-semibold">{spellSlots.byLevel[level]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">Keine Zauberplätze (noch kein Zauberer-Level erkannt).</p>
      )}

      {spells.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Noch keine Zauber eingetragen.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {spells.map((spell) => (
            <li
              key={spell.id}
              className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong>{spell.displayName}</strong>
                <SpellLevelBadge level={spell.spellLevel} />
                {spell.school && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium">
                    {spell.school}
                  </span>
                )}
                {spell.source === "homebrew" && (
                  /* uwe-badge-visibility had no CSS rule anywhere in the repo (dead modifier) —
                     rendered identically to a plain uwe-badge, so it maps to the same utility. */
                  <span className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium">
                    Homebrew
                  </span>
                )}
                {spell.prepared && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium">
                    Vorbereitet
                  </span>
                )}
              </div>
              {spell.description.trim() && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-primary">Beschreibung</summary>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">{spell.description}</p>
                </details>
              )}
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={togglePreparedAction}>
                    {renderHiddenFields()}
                    <input type="hidden" name="spellKey" value={spell.spellKey} />
                    <input type="hidden" name="prepared" value={spell.prepared ? "false" : "true"} />
                    <button type="submit" className={BTN_SMALL_PRIMARY}>
                      {spell.prepared ? "Nicht vorbereitet" : "Vorbereiten"}
                    </button>
                  </form>
                  <form action={removeSpellAction}>
                    {renderHiddenFields()}
                    <input type="hidden" name="spellKey" value={spell.spellKey} />
                    <button type="submit" className={BTN_SMALL_PRIMARY}>
                      Entfernen
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <div className="mt-2 flex flex-col gap-2">
            <h4 className="m-0 text-base font-semibold">Open5e / SRD suchen</h4>
            <p className="m-0 text-sm text-muted-foreground">
              Zauberdaten aus der Open5e-API (open5e.com, SRD-Inhalte). SRD/Open5e-Attribution
              bei externen Quellen beachten.
            </p>
            <label className={FIELD_LABEL}>
              Zaubername
              <input
                type="search"
                className={NATIVE_INPUT_CLASS}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="z. B. Fireball"
                autoComplete="off"
              />
            </label>
            {searchBusy && <p className="m-0 text-sm text-muted-foreground">Suche…</p>}
            {searchError && (
              <p className="m-0 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--uwe-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--uwe-danger)_12%,transparent)] px-3.5 py-2.5 text-sm text-destructive">
                {searchError}
              </p>
            )}
            {results.length > 0 && (
              <ul className="m-0 grid list-none gap-1.5 p-0">
                {results.map((result) => (
                  <li key={result.id}>
                    <form action={addSpellAction}>
                      {renderHiddenFields()}
                      <input type="hidden" name="spellKey" value={result.id} />
                      <input type="hidden" name="spellLevel" value={result.spellLevel} />
                      <input type="hidden" name="source" value="open5e" />
                      <input type="hidden" name="prepared" value="true" />
                      <input type="hidden" name="displayName" value={result.name} />
                      {result.school && <input type="hidden" name="school" value={result.school} />}
                      {result.description && (
                        <input type="hidden" name="description" value={result.description} />
                      )}
                      <button type="submit" className={BTN_SMALL_PRIMARY}>
                        {result.name} · Grad {result.spellLevel}
                        {result.school ? ` · ${result.school}` : ""}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {importSpellsByLevelAction ? (
            <form action={importSpellsByLevelAction} className="mt-4 grid gap-2">
              <h4 className="m-0 text-base font-semibold">Katalog-Import (Open5e / SRD)</h4>
              <p className="m-0 text-sm text-muted-foreground">
                Alle Zauber eines Grads aus dem Open5e-Katalog auf einmal hinzufügen (z. B. alle
                Zaubertricks oder Grad-1-Zauber).
              </p>
              <label className={FIELD_LABEL}>
                Zaubergrad
                {/* TODO(design-kit): natives Select bleibt — unkontrolliertes FormData-Feld. */}
                <select name="spellLevel" defaultValue={1} className={NATIVE_INPUT_CLASS}>
                  <option value={0}>Zaubertrick (Grad 0)</option>
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>
                      Grad {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="prepared" type="checkbox" />
                Als vorbereitet markieren
              </label>
              {renderHiddenFields()}
              <button type="submit" className={BTN_SMALL_PRIMARY}>
                Grad importieren
              </button>
            </form>
          ) : null}

          <form action={addHomebrewSpellAction} className="mt-4 grid gap-2">
            <h4 className="m-0 text-base font-semibold">Homebrew-Zauber</h4>
            <label className={FIELD_LABEL}>
              Name
              <input name="name" required maxLength={200} placeholder="z. B. Frostschlag" className={NATIVE_INPUT_CLASS} />
            </label>
            <label className={FIELD_LABEL}>
              Grad
              <input name="spellLevel" type="number" min={0} max={9} defaultValue={0} className={NATIVE_INPUT_CLASS} />
            </label>
            <label className={FIELD_LABEL}>
              Schule
              <input name="school" maxLength={100} placeholder="z. B. Hervorrufung" className={NATIVE_INPUT_CLASS} />
            </label>
            <label className={FIELD_LABEL}>
              Beschreibung
              <textarea
                name="description"
                rows={3}
                maxLength={5000}
                className="w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input name="prepared" type="checkbox" defaultChecked />
              Vorbereitet
            </label>
            {renderHiddenFields()}
            <button type="submit" className={BTN_SMALL_PRIMARY}>
              Homebrew hinzufügen
            </button>
          </form>
        </>
      )}
    </section>
  );
}
