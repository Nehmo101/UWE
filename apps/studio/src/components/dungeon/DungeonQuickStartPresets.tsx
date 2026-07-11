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
    <section className="mb-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Schnellstart-Vorlagen</h2>
      <p className="text-sm text-muted-foreground">
        Vorlage wählen — Felder werden vorausgefüllt, du kannst alles anpassen.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className="cursor-pointer rounded-[var(--radius)] border border-border bg-card p-4 text-left text-card-foreground shadow-sm hover:bg-muted"
          >
            <strong>{preset.title}</strong>
            <p className="mt-1.5 text-sm text-muted-foreground">{preset.summary}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
