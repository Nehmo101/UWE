"use client";

import { useEffect, useState } from "react";
import { rollOnTable, type RollTableEntry } from "@uwe/roll-tables/roll";
import { Button, NavIcon } from "@/src/components/ui";

const HISTORY_LIMIT = 10;

export interface RollHistoryEntry {
  tableId: string;
  tableName: string;
  result: string;
  rolledAt: string;
}

function historyKey(worldSlug: string): string {
  return `uwe_roll_history_${worldSlug}`;
}

function readHistory(worldSlug: string): RollHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(worldSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RollHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(worldSlug: string, entries: RollHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(historyKey(worldSlug), JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
}

interface RollTableRollButtonProps {
  worldSlug: string;
  tableId: string;
  tableName: string;
  entries: RollTableEntry[];
}

export function RollTableRollButton({
  worldSlug,
  tableId,
  tableName,
  entries,
}: RollTableRollButtonProps) {
  const [lastResult, setLastResult] = useState<string | null>(null);

  function handleRoll() {
    const rolled = rollOnTable(entries);
    const resultText = rolled ? rolled.entry.label : "Tabelle ist leer.";
    setLastResult(resultText);

    const entry: RollHistoryEntry = {
      tableId,
      tableName,
      result: resultText,
      rolledAt: new Date().toISOString(),
    };
    const next = [entry, ...readHistory(worldSlug)].slice(0, HISTORY_LIMIT);
    writeHistory(worldSlug, next);
    window.dispatchEvent(new CustomEvent("uwe-roll-history-updated", { detail: { worldSlug } }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={handleRoll}>
        <NavIcon name="dices" width={16} height={16} />
        Würfeln
      </Button>
      {lastResult && (
        <span role="status" className="text-sm text-success">
          Ergebnis: <strong>{lastResult}</strong>
        </span>
      )}
    </div>
  );
}

export function RollHistoryPanel({ worldSlug }: { worldSlug: string }) {
  const [history, setHistory] = useState<RollHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readHistory(worldSlug));
    function onUpdate(event: Event) {
      const detail = (event as CustomEvent<{ worldSlug: string }>).detail;
      if (detail?.worldSlug === worldSlug) {
        setHistory(readHistory(worldSlug));
      }
    }
    window.addEventListener("uwe-roll-history-updated", onUpdate);
    return () => window.removeEventListener("uwe-roll-history-updated", onUpdate);
  }, [worldSlug]);

  if (history.length === 0) {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        Noch keine Würfe in dieser Sitzung — der Verlauf der letzten {HISTORY_LIMIT} Ergebnisse erscheint hier.
      </p>
    );
  }

  return (
    <ul className="m-0 list-none p-0">
      {history.map((entry, index) => (
        <li key={`${entry.rolledAt}-${index}`} className="border-b border-border/60 py-2">
          <strong>{entry.tableName}</strong>
          <span className="text-sm text-muted-foreground">
            {" "}
            — {entry.result} ·{" "}
            {new Date(entry.rolledAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
