"use client";

import { useMemo } from "react";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function highlightPromptBody(body: string, knownVariables: string[]): React.ReactNode[] {
  const known = new Set(knownVariables);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN.source, "g");

  while ((match = re.exec(body)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push(body.slice(lastIndex, start));
    }
    const name = match[1]!;
    parts.push(
      <mark
        key={`${name}-${start}`}
        className={known.has(name) ? "uwe-prompt-var-known" : "uwe-prompt-var-unknown"}
        title={known.has(name) ? `Variable: ${name}` : `Unbekannte Variable: ${name}`}
      >
        {match[0]}
      </mark>,
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [body];
}

interface Props {
  body: string;
  variables: string[];
}

export function PromptBodyEditor({ body, variables }: Props) {
  const highlighted = useMemo(() => highlightPromptBody(body, variables), [body, variables]);

  return (
    <div className="uwe-v2-section">
      {variables.length > 0 ? (
        <section className="uwe-v2-card uwe-v2-card-padded" style={{ marginBottom: "0.75rem" }}>
          <h3 className="uwe-v2-section-title">Variablen</h3>
          <ul className="uwe-linked-list">
            {variables.map((name) => (
              <li key={name}>
                <code>{`{{${name}}}`}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="uwe-dashboard-muted">
          Keine dokumentierten Variablen — <code>{`{{name}}`}</code> im Body werden trotzdem hervorgehoben.
        </p>
      )}

      <label>
        Body (Vorschau)
        <pre
          className="uwe-prompt-body-preview"
          style={{
            whiteSpace: "pre-wrap",
            padding: "0.75rem",
            borderRadius: "6px",
            background: "var(--uwe-code-bg, rgba(0,0,0,0.05))",
            minHeight: "6rem",
          }}
        >
          {highlighted}
        </pre>
      </label>
    </div>
  );
}
