"use client";

import { useState } from "react";

interface Props {
  exportUrl: string;
}

export function PrintListPreviewPanel({ exportUrl }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <section className="uwe-panel">
      <h2>Druckvorschau</h2>
      <p className="uwe-table-sub">
        HTML-Vorschau der gesamten Druckliste — ohne neuen Tab zu öffnen.
      </p>
      <div className="uwe-form-actions">
        <button
          type="button"
          className="uwe-v2-btn"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Vorschau ausblenden" : "Vorschau anzeigen"}
        </button>
        <a href={exportUrl} className="uwe-v2-btn uwe-v2-btn-secondary" target="_blank" rel="noreferrer">
          In neuem Tab öffnen
        </a>
      </div>
      {visible ? (
        <iframe
          title="Drucklistenvorschau"
          src={exportUrl}
          className="uwe-print-list-preview-frame"
          style={{
            width: "100%",
            minHeight: "28rem",
            marginTop: "0.75rem",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            background: "#fff",
          }}
        />
      ) : null}
    </section>
  );
}
