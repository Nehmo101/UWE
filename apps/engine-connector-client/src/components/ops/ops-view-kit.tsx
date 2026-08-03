import type { ReactNode } from "react";

import { HealthBadge } from "@uwe/shared-ui";

/**
 * Bausteine der Betrieb-Ansichten.
 *
 * Die Nutzdaten kommen zur Laufzeit aus `ops-cli` und sind für TypeScript
 * `unknown` — deshalb lesen die Ansichten jedes Feld über die Helfer hier
 * heraus, statt auf eine Form zu vertrauen. Ändert der Host eine Form, fehlt
 * ein Feld und der Rest bleibt lesbar; abstürzen kann keine Ansicht.
 */

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Text eines Feldes; leer, `null` und `undefined` werden zum Gedankenstrich. */
export function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return value.toLocaleString("de-DE");
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function flag(value: unknown): string {
  return typeof value === "boolean" ? (value ? "Ja" : "Nein") : "—";
}

export function dateTime(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? text(value)
    : date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export interface Field {
  label: string;
  value: ReactNode;
  hint?: string;
}

/** Feld/Wert-Liste — die Standarddarstellung für einen Statusblock. */
export function Fields({ items }: { items: Field[] }) {
  if (items.length === 0) return <Empty>Keine Angaben.</Empty>;
  return (
    <dl className="connector-kv connector-kv-compact">
      {items.map((item) => (
        <div key={item.label}>
          <dt>
            {item.label}
            {item.hint ? <small className="connector-muted"> · {item.hint}</small> : null}
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pills({ items }: { items: Array<{ label: string; value?: ReactNode }> }) {
  if (items.length === 0) return null;
  return (
    <div className="connector-stats-row">
      {items.map((item) => (
        <span key={item.label} className="connector-stat-pill">
          {item.label}
          {item.value === undefined ? null : <strong> {item.value}</strong>}
        </span>
      ))}
    </div>
  );
}

export function Notes({ items }: { items: unknown[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="connector-note-list">
      {items.map((item, index) => (
        <li key={`${String(item)}-${index}`}>{text(item)}</li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="connector-empty-state">{children}</div>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="connector-table-wrap">
      <table className="connector-table">{children}</table>
    </div>
  );
}

/** Statusfarbe aus einem Level-/Severity-Wort des Hosts. */
export function toneOf(value: unknown): "ok" | "degraded" | "error" {
  const word = String(value ?? "").toLowerCase();
  if (["error", "critical", "failed", "fail", "missing"].includes(word)) return "error";
  if (["warning", "warn", "degraded", "pending", "attention", "info"].includes(word)) return "degraded";
  return "ok";
}

export function Badge({ level, label }: { level: unknown; label: string }) {
  return <HealthBadge status={toneOf(level)} label={label} />;
}

/**
 * Die vollständige Antwort bleibt eine Klappe weit entfernt: Die Felder oben
 * zeigen das Wesentliche, ein neues Feld des Hosts ist hier trotzdem sofort
 * sichtbar, ohne dass jemand erst die Ansicht nachziehen muss.
 */
export function RawData({ data }: { data: unknown }) {
  return (
    <details className="connector-inline-card">
      <summary className="connector-muted">Rohdaten anzeigen</summary>
      <pre className="connector-pre">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
