"use client";

import { useMemo, useState } from "react";

interface Props {
  body: string;
  variables: string[];
}

/** Ersetzt `{{name}}` durch die Werte; unbekannte Platzhalter bleiben leer. */
function fill(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => values[name] ?? "");
}

export function PromptFillClient({ body, variables }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const filled = useMemo(() => fill(body, values), [body, values]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="uwe-v2-section">
      {variables.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {variables.map((name) => (
            <label key={name}>
              {name}
              <input
                type="text"
                value={values[name] ?? ""}
                onChange={(event) => setValues((prev) => ({ ...prev, [name]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="uwe-dashboard-muted">Keine Variablen — direkt kopierbar.</p>
      )}

      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: "0.75rem",
          borderRadius: "6px",
          background: "var(--uwe-code-bg, rgba(0,0,0,0.05))",
          overflowX: "auto",
        }}
      >
        {filled}
      </pre>

      <div className="uwe-form-actions">
        <button type="button" className="uwe-v2-btn uwe-v2-btn-primary" onClick={() => void copy()}>
          {copied ? "✓ Kopiert" : "Als Prompt kopieren"}
        </button>
      </div>
    </div>
  );
}
