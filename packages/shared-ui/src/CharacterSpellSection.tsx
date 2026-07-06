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
  return <span className="uwe-badge uwe-badge-type">{level === 0 ? "Zaubertrick" : `Grad ${level}`}</span>;
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
    <section className="auth-character-spells">
      <h3>Zauber</h3>
      <p className="auth-muted">
        {preparedCount} vorbereitet · Zaubergrad-Slots (Caster-Level {spellSlots.casterLevel})
      </p>

      {slotLevels.length > 0 ? (
        <dl className="auth-character-sheet-summary">
          {slotLevels.map((level) => (
            <div key={level}>
              <dt>Grad {level}</dt>
              <dd>{spellSlots.byLevel[level]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="auth-muted">Keine Zauberplätze (noch kein Zauberer-Level erkannt).</p>
      )}

      {spells.length === 0 ? (
        <p className="auth-muted">Noch keine Zauber eingetragen.</p>
      ) : (
        <ul className="auth-character-spell-list">
          {spells.map((spell) => (
            <li key={spell.id} className="auth-character-spell-item">
              <div className="auth-character-spell-main">
                <strong>{spell.displayName}</strong>
                <SpellLevelBadge level={spell.spellLevel} />
                {spell.school && <span className="uwe-badge">{spell.school}</span>}
                {spell.source === "homebrew" && (
                  <span className="uwe-badge uwe-badge-visibility">Homebrew</span>
                )}
                {spell.prepared && <span className="uwe-badge">Vorbereitet</span>}
              </div>
              {spell.description.trim() && (
                <details className="auth-character-spell-description">
                  <summary>Beschreibung</summary>
                  <p className="auth-muted">{spell.description}</p>
                </details>
              )}
              {canEdit && (
                <div className="auth-character-spell-actions">
                  <form action={togglePreparedAction}>
                    {renderHiddenFields()}
                    <input type="hidden" name="spellKey" value={spell.spellKey} />
                    <input type="hidden" name="prepared" value={spell.prepared ? "false" : "true"} />
                    <button type="submit" className="auth-btn auth-btn-small">
                      {spell.prepared ? "Nicht vorbereitet" : "Vorbereiten"}
                    </button>
                  </form>
                  <form action={removeSpellAction}>
                    {renderHiddenFields()}
                    <input type="hidden" name="spellKey" value={spell.spellKey} />
                    <button type="submit" className="auth-btn auth-btn-small">
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
          <div className="auth-character-spell-search">
            <h4>Open5e / SRD suchen</h4>
            <p className="auth-muted">
              Zauberdaten aus der Open5e-API (open5e.com, SRD-Inhalte). SRD/Open5e-Attribution
              bei externen Quellen beachten.
            </p>
            <label>
              Zaubername
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="z. B. Fireball"
                autoComplete="off"
              />
            </label>
            {searchBusy && <p className="auth-muted">Suche…</p>}
            {searchError && <p className="auth-error">{searchError}</p>}
            {results.length > 0 && (
              <ul className="auth-character-spell-search-results">
                {results.map((result) => (
                  <li key={result.id}>
                    <form action={addSpellAction} className="auth-character-spell-search-form">
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
                      <button type="submit" className="auth-btn auth-btn-small">
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
            <form action={importSpellsByLevelAction} className="auth-note-form auth-character-spell-homebrew">
              <h4>Katalog-Import (Open5e / SRD)</h4>
              <p className="auth-muted">
                Alle Zauber eines Grads aus dem Open5e-Katalog auf einmal hinzufügen (z. B. alle
                Zaubertricks oder Grad-1-Zauber).
              </p>
              <label>
                Zaubergrad
                <select name="spellLevel" defaultValue={1}>
                  <option value={0}>Zaubertrick (Grad 0)</option>
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>
                      Grad {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-checkbox-label">
                <input name="prepared" type="checkbox" />
                Als vorbereitet markieren
              </label>
              {renderHiddenFields()}
              <button type="submit" className="auth-btn auth-btn-small">
                Grad importieren
              </button>
            </form>
          ) : null}

          <form action={addHomebrewSpellAction} className="auth-note-form auth-character-spell-homebrew">
            <h4>Homebrew-Zauber</h4>
            <label>
              Name
              <input name="name" required maxLength={200} placeholder="z. B. Frostschlag" />
            </label>
            <label>
              Grad
              <input name="spellLevel" type="number" min={0} max={9} defaultValue={0} />
            </label>
            <label>
              Schule
              <input name="school" maxLength={100} placeholder="z. B. Hervorrufung" />
            </label>
            <label>
              Beschreibung
              <textarea name="description" rows={3} maxLength={5000} />
            </label>
            <label className="auth-checkbox-label">
              <input name="prepared" type="checkbox" defaultChecked />
              Vorbereitet
            </label>
            {renderHiddenFields()}
            <button type="submit" className="auth-btn auth-btn-small">
              Homebrew hinzufügen
            </button>
          </form>
        </>
      )}
    </section>
  );
}
