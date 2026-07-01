"use client";

import { useMemo, useState } from "react";
import type { LevelUpFieldSuggestion, LevelUpSuggestions } from "@uwe/database/server";

export interface CharacterLevelUpPanelProps {
  suggestions: LevelUpSuggestions;
  canEdit: boolean;
  hiddenFields: Record<string, string>;
  applyLevelUpAction: (formData: FormData) => void | Promise<void>;
}

function defaultChecked(field: LevelUpFieldSuggestion): boolean {
  if (!field.applyable) {
    return false;
  }
  return field.key === "level" || field.key === "maxHp" || field.key === "classes";
}

export function CharacterLevelUpPanel({
  suggestions,
  canEdit,
  hiddenFields,
  applyLevelUpAction,
}: CharacterLevelUpPanelProps) {
  const [pickedClass, setPickedClass] = useState(
    suggestions.primaryClass ?? suggestions.classOptions[0] ?? "",
  );

  const applyableFields = useMemo(
    () => suggestions.fields.filter((field) => field.applyable),
    [suggestions.fields],
  );

  function renderHiddenFields() {
    return Object.entries(hiddenFields).map(([name, value]) => (
      <input key={name} type="hidden" name={name} value={value} />
    ));
  }

  if (!canEdit) {
    return null;
  }

  return (
    <section className="auth-character-level-up">
      <h3>Level-Up-Assistent</h3>
      <p className="auth-muted">
        Stufe {suggestions.fromLevel} → {suggestions.toLevel}: Vorschläge prüfen und Felder bestätigen.
      </p>

      {suggestions.needsClassPicker && (
        <label>
          Primärklasse
          <select
            name="pickedClass"
            value={pickedClass}
            onChange={(event) => setPickedClass(event.target.value)}
            required
          >
            {suggestions.classOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="auth-character-level-up-checklist">
        {suggestions.fields.map((field) => (
          <li key={field.key} className="auth-character-level-up-item">
            <div className="auth-character-level-up-main">
              {field.applyable ? (
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    name={`apply${field.key.charAt(0).toUpperCase()}${field.key.slice(1)}`}
                    defaultChecked={defaultChecked(field)}
                    value="true"
                  />
                  <strong>{field.label}</strong>
                </label>
              ) : (
                <strong>{field.label}</strong>
              )}
              <span className="auth-muted">
                {field.currentDisplay} → {field.suggestedDisplay}
              </span>
              <span className="auth-muted">{field.hint}</span>
            </div>
          </li>
        ))}
      </ul>

      <form action={applyLevelUpAction} className="auth-note-form auth-character-level-up-form">
        {renderHiddenFields()}
        {!suggestions.needsClassPicker && suggestions.primaryClass && (
          <input type="hidden" name="pickedClass" value={suggestions.primaryClass} />
        )}
        {suggestions.needsClassPicker && (
          <input type="hidden" name="pickedClass" value={pickedClass} />
        )}
        <label>
          TP-Erhöhung (optional anpassen)
          <input
            name="hpIncrease"
            type="number"
            min={0}
            max={50}
            defaultValue={suggestions.suggestedHpIncrease}
          />
          <span className="auth-muted">{suggestions.hpRollHint}</span>
        </label>
        <button type="submit" className="auth-btn auth-btn-small">
          Ausgewählte Level-Up-Felder anwenden
        </button>
      </form>

      {applyableFields.length === 0 && (
        <p className="auth-muted">Keine anwendbaren Felder für dieses Level-Up.</p>
      )}
    </section>
  );
}
