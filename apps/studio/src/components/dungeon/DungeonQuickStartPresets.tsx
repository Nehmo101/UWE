"use client";

const PRESETS = [
  {
    id: "ruins",
    title: "Verlassene Ruine",
    summary: "Einstöckiger Dungeon mit Vorhalle, Truhenraum und Bosskammer.",
    description:
      "Eine verfallene Steinruine mit drei Räumen: Vorhalle, Truhenkammer und Bosskammer.\n\n[[Loot]] und [[Encounter]]-Links können später ergänzt werden.",
  },
  {
    id: "cave",
    title: "Höhlensystem",
    summary: "Zwei Ebenen — oberer Eingang und tieferes Nest.",
    description:
      "Ein natürliches Höhlensystem mit feuchten Gängen und einem tieferen Nest.\n\nGeeignet für kurze One-Shot-Sessions.",
  },
  {
    id: "temple",
    title: "Tempel der Schatten",
    summary: "Kultstätte mit Rätselraum und verstecktem Schrein.",
    description:
      "Ein düsterer Tempel mit Vorhof, Rätselkammer und verstecktem Schrein.\n\nDM-Notizen: Ritual-Trigger und Geheimtüren vormerken.",
  },
] as const;

interface Props {
  formId: string;
}

export function DungeonQuickStartPresets({ formId }: Props) {
  function applyPreset(preset: (typeof PRESETS)[number]) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const title = form.elements.namedItem("title") as HTMLInputElement | null;
    const summary = form.elements.namedItem("summary") as HTMLTextAreaElement | null;
    const description = form.elements.namedItem("description") as HTMLTextAreaElement | null;
    if (title) title.value = preset.title;
    if (summary) summary.value = preset.summary;
    if (description) description.value = preset.description;
    title?.focus();
  }

  return (
    <section className="uwe-v2-section">
      <h2>Schnellstart-Vorlagen</h2>
      <p className="uwe-hint">Vorlage wählen — Felder werden vorausgefüllt, du kannst alles anpassen.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
          gap: "0.75rem",
        }}
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="uwe-v2-card"
            style={{ textAlign: "left", cursor: "pointer" }}
            onClick={() => applyPreset(preset)}
          >
            <strong>{preset.title}</strong>
            <p className="uwe-hint" style={{ margin: "0.35rem 0 0" }}>
              {preset.summary}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
