"use client";

import { useMemo, useState } from "react";
import {
  exportStructuredStatblockFiveTools,
  exportStructuredStatblockHomebrewery,
  exportStructuredStatblockJson,
} from "@uwe/dnd-api";
import {
  createStatblockLabelAction,
  upsertStatblockAction,
} from "@/app/worlds/[worldSlug]/statblock-studio-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  initialJson: string;
  rulesEdition: string;
}

export function StatblockStudioPanel({
  worldSlug,
  pageId,
  pageSlug,
  category,
  initialJson,
  rulesEdition,
}: Props) {
  const [jsonText, setJsonText] = useState(initialJson);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      return null;
    }
  }, [jsonText]);

  const exports = useMemo(() => {
    if (!parsed) {
      return null;
    }
    return {
      json: exportStructuredStatblockJson(parsed),
      homebrewery: exportStructuredStatblockHomebrewery(parsed),
      fiveTools: exportStructuredStatblockFiveTools(parsed),
    };
  }, [parsed]);

  async function saveStatblock() {
    if (!parsed) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await upsertStatblockAction({
        worldSlug,
        pageId,
        pageSlug,
        category,
        rulesEdition,
        dataJson: JSON.stringify(parsed),
      });
      setStatus("Statblock gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function createStatblockLabel() {
    setBusy(true);
    setStatus(null);
    try {
      await createStatblockLabelAction({
        worldSlug,
        pageId,
        pageSlug,
        category,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Label-Erstellung fehlgeschlagen.");
      setBusy(false);
    }
  }

  async function copyExport(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} in Zwischenablage kopiert.`);
    } catch {
      setStatus(`${label} konnte nicht kopiert werden.`);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Statblock Studio</h2>
      <p className="uwe-hint">
        Strukturiertes JSON ({rulesEdition}) — Export nach Homebrewery, 5e.tools-JSON oder Roh-JSON.
        SRD/Open5e-Attribution bei externen Quellen beachten.
      </p>

      <label>
        Statblock JSON
        <textarea
          rows={16}
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          spellCheck={false}
        />
      </label>

      {!parsed && (
        <p className="uwe-form-error" role="alert">
          Ungültiges JSON — Speichern und Export sind deaktiviert.
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!parsed || busy}
          onClick={() => void saveStatblock()}
        >
          {busy ? "Speichere…" : "Statblock speichern"}
        </button>
        {exports && (
          <>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              onClick={() => void copyExport("JSON", exports.json)}
            >
              JSON kopieren
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              onClick={() => void copyExport("Homebrewery", exports.homebrewery)}
            >
              Homebrewery kopieren
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              onClick={() => void copyExport("5e.tools JSON", exports.fiveTools)}
            >
              5e.tools JSON kopieren
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              disabled={busy}
              onClick={() => void createStatblockLabel()}
            >
              {busy ? "Erstelle Label…" : "6×4-Label erstellen"}
            </button>
          </>
        )}
      </div>

      {status && <p className="uwe-hint">{status}</p>}
    </section>
  );
}
