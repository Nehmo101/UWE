"use client";

import { useMemo, useState } from "react";
import {
  createEmptyStatblockDraft,
  exportStructuredStatblockFiveTools,
  exportStructuredStatblockHomebrewery,
  exportStructuredStatblockJson,
  formatAbilityModifier,
  STATBLOCK_ABILITY_KEYS,
  statblockDraftFromData,
  statblockDraftToData,
  validateStatblockDraft,
  type StatblockAbilityKey,
  type StatblockEntryDraft,
  type StructuredStatblockDraft,
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

type EditorMode = "form" | "json";

interface EntrySectionConfig {
  key: "traits" | "actions" | "reactions" | "legendaryActions";
  title: string;
  addLabel: string;
}

const ENTRY_SECTIONS: EntrySectionConfig[] = [
  { key: "traits", title: "Eigenschaften", addLabel: "Eigenschaft hinzufügen" },
  { key: "actions", title: "Aktionen", addLabel: "Aktion hinzufügen" },
  { key: "reactions", title: "Reaktionen", addLabel: "Reaktion hinzufügen" },
  { key: "legendaryActions", title: "Legendäre Aktionen", addLabel: "Legendäre Aktion hinzufügen" },
];

const ABILITY_LABELS: Record<StatblockAbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

function parseInitial(initialJson: string) {
  try {
    return statblockDraftFromData(JSON.parse(initialJson) as unknown);
  } catch {
    return { draft: createEmptyStatblockDraft(), extras: {} };
  }
}

export function StatblockStudioPanel({
  worldSlug,
  pageId,
  pageSlug,
  category,
  initialJson,
  rulesEdition,
}: Props) {
  const [initial] = useState(() => parseInitial(initialJson));
  const [draft, setDraft] = useState<StructuredStatblockDraft>(initial.draft);
  const [extras, setExtras] = useState<Record<string, unknown>>(initial.extras);
  const [mode, setMode] = useState<EditorMode>("form");
  const [jsonText, setJsonText] = useState(initialJson);
  const [edition, setEdition] = useState(
    rulesEdition === "dnd5e_2014" ? "dnd5e_2014" : "dnd5e_2024",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const jsonParsed = useMemo(() => {
    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      return null;
    }
  }, [jsonText]);

  const formErrors = useMemo(() => validateStatblockDraft(draft), [draft]);

  const currentData: unknown =
    mode === "form" ? statblockDraftToData(draft, extras) : jsonParsed;
  const canSave = mode === "form" ? formErrors.length === 0 : jsonParsed != null;

  const exports = useMemo(() => {
    if (currentData == null) {
      return null;
    }
    return {
      json: exportStructuredStatblockJson(currentData),
      homebrewery: exportStructuredStatblockHomebrewery(currentData),
      fiveTools: exportStructuredStatblockFiveTools(currentData),
    };
  }, [currentData]);

  const extrasCount = Object.keys(extras).length;

  function updateDraft(patch: Partial<StructuredStatblockDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function updateAbility(key: StatblockAbilityKey, raw: string) {
    const score = Number(raw);
    setDraft((prev) => ({
      ...prev,
      abilities: { ...prev.abilities, [key]: Number.isFinite(score) ? score : 0 },
    }));
  }

  function updateEntries(section: EntrySectionConfig["key"], entries: StatblockEntryDraft[]) {
    setDraft((prev) => ({ ...prev, [section]: entries }));
  }

  function switchMode(next: EditorMode) {
    if (next === mode) {
      return;
    }
    if (next === "json") {
      setJsonText(JSON.stringify(statblockDraftToData(draft, extras), null, 2));
      setMode("json");
      return;
    }
    if (jsonParsed == null) {
      setStatus("Ungültiges JSON — bitte korrigieren, bevor du zum Formular wechselst.");
      return;
    }
    const parsed = statblockDraftFromData(jsonParsed);
    setDraft(parsed.draft);
    setExtras(parsed.extras);
    setMode("form");
  }

  async function saveStatblock() {
    if (currentData == null || !canSave) {
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
        rulesEdition: edition,
        dataJson: JSON.stringify(currentData),
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
        Strukturierter Statblock — Export nach Homebrewery, 5e.tools-JSON oder Roh-JSON.
        SRD/Open5e-Attribution bei externen Quellen beachten.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className={mode === "form" ? "uwe-v2-btn uwe-v2-btn-primary" : "uwe-v2-btn uwe-v2-btn-secondary"}
          onClick={() => switchMode("form")}
        >
          Formular
        </button>
        <button
          type="button"
          className={mode === "json" ? "uwe-v2-btn uwe-v2-btn-primary" : "uwe-v2-btn uwe-v2-btn-secondary"}
          onClick={() => switchMode("json")}
        >
          JSON
        </button>
        <label style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          Regelwerk
          <select value={edition} onChange={(event) => setEdition(event.target.value)}>
            <option value="dnd5e_2024">D&amp;D 5e (2024)</option>
            <option value="dnd5e_2014">D&amp;D 5e (2014)</option>
          </select>
        </label>
      </div>

      {mode === "form" ? (
        <>
          <div className="uwe-form-grid">
            <label>
              Name
              <input
                type="text"
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                placeholder="z. B. Goblin"
              />
            </label>
            <label>
              Größe
              <input
                type="text"
                value={draft.size}
                onChange={(event) => updateDraft({ size: event.target.value })}
                placeholder="z. B. Small"
              />
            </label>
            <label>
              Typ
              <input
                type="text"
                value={draft.type}
                onChange={(event) => updateDraft({ type: event.target.value })}
                placeholder="z. B. humanoid"
              />
            </label>
            <label>
              Gesinnung
              <input
                type="text"
                value={draft.alignment}
                onChange={(event) => updateDraft({ alignment: event.target.value })}
                placeholder="z. B. neutral evil"
              />
            </label>
            <label>
              Rüstungsklasse (AC)
              <input
                type="text"
                value={draft.ac}
                onChange={(event) => updateDraft({ ac: event.target.value })}
                placeholder="z. B. 15 oder 15 (natural armor)"
              />
            </label>
            <label>
              Trefferpunkte (HP)
              <input
                type="text"
                value={draft.hp}
                onChange={(event) => updateDraft({ hp: event.target.value })}
                placeholder="z. B. 22"
              />
            </label>
            <label>
              Trefferwürfel
              <input
                type="text"
                value={draft.hitDice}
                onChange={(event) => updateDraft({ hitDice: event.target.value })}
                placeholder="z. B. 5d8"
              />
            </label>
            <label>
              Geschwindigkeit
              <input
                type="text"
                value={draft.speed}
                onChange={(event) => updateDraft({ speed: event.target.value })}
                placeholder="z. B. 30 ft., fly 60 ft."
              />
            </label>
            <label>
              Herausforderungsgrad (CR)
              <input
                type="text"
                value={draft.cr}
                onChange={(event) => updateDraft({ cr: event.target.value })}
                placeholder="z. B. 1/4"
              />
            </label>
          </div>

          <fieldset className="uwe-fieldset">
            <legend>Attributswerte</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {STATBLOCK_ABILITY_KEYS.map((key) => (
                <label key={key}>
                  {ABILITY_LABELS[key]}
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={draft.abilities[key]}
                    onChange={(event) => updateAbility(key, event.target.value)}
                  />
                  <small className="uwe-field-hint">
                    Mod {formatAbilityModifier(draft.abilities[key])}
                  </small>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="uwe-form-grid">
            <label>
              Rettungswürfe
              <input
                type="text"
                value={draft.saves}
                onChange={(event) => updateDraft({ saves: event.target.value })}
                placeholder="z. B. Dex +4, Con +2"
              />
            </label>
            <label>
              Fertigkeiten
              <input
                type="text"
                value={draft.skills}
                onChange={(event) => updateDraft({ skills: event.target.value })}
                placeholder="z. B. Stealth +6, Perception +3"
              />
            </label>
            <label>
              Sinne
              <input
                type="text"
                value={draft.senses}
                onChange={(event) => updateDraft({ senses: event.target.value })}
                placeholder="z. B. darkvision 60 ft., passive Perception 9"
              />
            </label>
            <label>
              Sprachen
              <input
                type="text"
                value={draft.languages}
                onChange={(event) => updateDraft({ languages: event.target.value })}
                placeholder="z. B. Common, Goblin"
              />
            </label>
          </div>

          {ENTRY_SECTIONS.map((section) => (
            <EntrySectionEditor
              key={section.key}
              config={section}
              entries={draft[section.key]}
              onChange={(entries) => updateEntries(section.key, entries)}
            />
          ))}

          {extrasCount > 0 && (
            <p className="uwe-field-hint">
              {extrasCount} zusätzliche{extrasCount === 1 ? "s" : ""} JSON-Feld
              {extrasCount === 1 ? "" : "er"} (z. B. aus Import) bleib
              {extrasCount === 1 ? "t" : "en"} beim Speichern erhalten — bearbeitbar im
              JSON-Modus.
            </p>
          )}

          {formErrors.length > 0 && (
            <ul className="uwe-form-error" role="alert" style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {formErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <label>
            Statblock JSON
            <textarea
              rows={16}
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              spellCheck={false}
            />
          </label>
          {jsonParsed == null && (
            <p className="uwe-form-error" role="alert">
              Ungültiges JSON — Speichern und Export sind deaktiviert.
            </p>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!canSave || busy}
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

function EntrySectionEditor({
  config,
  entries,
  onChange,
}: {
  config: EntrySectionConfig;
  entries: StatblockEntryDraft[];
  onChange: (entries: StatblockEntryDraft[]) => void;
}) {
  function updateEntry(index: number, patch: Partial<StatblockEntryDraft>) {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="uwe-fieldset">
      <legend>{config.title}</legend>
      {entries.length === 0 && (
        <p className="uwe-field-hint" style={{ margin: 0 }}>
          Keine Einträge.
        </p>
      )}
      {entries.map((entry, index) => (
        <div
          key={index}
          style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr auto" }}
        >
          <input
            type="text"
            value={entry.name}
            onChange={(event) => updateEntry(index, { name: event.target.value })}
            placeholder="Name"
            aria-label={`${config.title} — Name`}
          />
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => removeEntry(index)}
            aria-label={`${config.title} — Eintrag entfernen`}
          >
            Entfernen
          </button>
          <textarea
            rows={2}
            value={entry.desc}
            onChange={(event) => updateEntry(index, { desc: event.target.value })}
            placeholder="Beschreibung"
            aria-label={`${config.title} — Beschreibung`}
            style={{ gridColumn: "1 / -1" }}
          />
        </div>
      ))}
      <div>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-secondary"
          onClick={() => onChange([...entries, { name: "", desc: "" }])}
        >
          {config.addLabel}
        </button>
      </div>
    </fieldset>
  );
}
