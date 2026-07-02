"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface EquipmentSearchResult {
  id: string;
  name: string;
  url?: string;
  provider: "open5e" | "dnd5e_srd";
  kind?: "weapon" | "magicitem" | "equipment" | null;
  summary?: string;
}

export function equipmentKindLabel(kind: EquipmentSearchResult["kind"]): string | null {
  switch (kind) {
    case "weapon":
      return "Waffe";
    case "magicitem":
      return "Magischer Gegenstand";
    case "equipment":
      return "SRD-Ausrüstung";
    default:
      return null;
  }
}

interface Props {
  searchEquipmentUrl: string;
  label: string;
  placeholder?: string;
  renderResult: (result: EquipmentSearchResult) => ReactNode;
}

/**
 * Debounced SRD/Open5e equipment search against the Studio DnD API.
 * Result rendering is delegated so callers can apply results differently
 * (page base vs. generator input).
 */
export function EquipmentSearchBox({
  searchEquipmentUrl,
  label,
  placeholder = "z. B. Longsword, Oil of Sharpness",
  renderResult,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquipmentSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      setSearchError(null);
      try {
        const response = await fetch(`${searchEquipmentUrl}?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as {
          results?: EquipmentSearchResult[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Ausrüstungssuche fehlgeschlagen.");
        }
        setResults(data.results ?? []);
      } catch (error) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Ausrüstungssuche fehlgeschlagen.");
      } finally {
        setSearchBusy(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, searchEquipmentUrl]);

  return (
    <div className="auth-character-spell-search">
      <label>
        {label}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      {searchBusy && <p className="auth-muted">Suche…</p>}
      {searchError && <p className="auth-error">{searchError}</p>}
      {results.length > 0 && (
        <ul className="auth-character-spell-search-results">
          {results.map((result) => (
            <li key={`${result.provider}:${result.id}`}>{renderResult(result)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
