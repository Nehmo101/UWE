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
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

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

/** TODO(design-kit): Controlled Select ohne Leerwert (Regelwerk) — Kit-Select folgt später. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <Card>
      <CardHeader>
        <CardTitle>Statblock Studio</CardTitle>
        <CardDescription>
          Strukturierter Statblock — Export nach Homebrewery, 5e.tools-JSON oder Roh-JSON.
          SRD/Open5e-Attribution bei externen Quellen beachten.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={mode === "form" ? "default" : "secondary"}
            onClick={() => switchMode("form")}
          >
            Formular
          </Button>
          <Button
            type="button"
            variant={mode === "json" ? "default" : "secondary"}
            onClick={() => switchMode("json")}
          >
            JSON
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="statblock-edition">Regelwerk</Label>
            <select
              id="statblock-edition"
              value={edition}
              onChange={(event) => setEdition(event.target.value)}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="dnd5e_2024">D&amp;D 5e (2024)</option>
              <option value="dnd5e_2014">D&amp;D 5e (2014)</option>
            </select>
          </div>
        </div>

        {mode === "form" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-name">Name</Label>
                <Input id="statblock-name" type="text" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="z. B. Goblin" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-size">Größe</Label>
                <Input id="statblock-size" type="text" value={draft.size} onChange={(event) => updateDraft({ size: event.target.value })} placeholder="z. B. Small" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-type">Typ</Label>
                <Input id="statblock-type" type="text" value={draft.type} onChange={(event) => updateDraft({ type: event.target.value })} placeholder="z. B. humanoid" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-alignment">Gesinnung</Label>
                <Input id="statblock-alignment" type="text" value={draft.alignment} onChange={(event) => updateDraft({ alignment: event.target.value })} placeholder="z. B. neutral evil" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-ac">Rüstungsklasse (AC)</Label>
                <Input id="statblock-ac" type="text" value={draft.ac} onChange={(event) => updateDraft({ ac: event.target.value })} placeholder="z. B. 15 oder 15 (natural armor)" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-hp">Trefferpunkte (HP)</Label>
                <Input id="statblock-hp" type="text" value={draft.hp} onChange={(event) => updateDraft({ hp: event.target.value })} placeholder="z. B. 22" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-hit-dice">Trefferwürfel</Label>
                <Input id="statblock-hit-dice" type="text" value={draft.hitDice} onChange={(event) => updateDraft({ hitDice: event.target.value })} placeholder="z. B. 5d8" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-speed">Geschwindigkeit</Label>
                <Input id="statblock-speed" type="text" value={draft.speed} onChange={(event) => updateDraft({ speed: event.target.value })} placeholder="z. B. 30 ft., fly 60 ft." />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-cr">Herausforderungsgrad (CR)</Label>
                <Input id="statblock-cr" type="text" value={draft.cr} onChange={(event) => updateDraft({ cr: event.target.value })} placeholder="z. B. 1/4" />
              </div>
            </div>

            <fieldset className="rounded-[var(--radius)] border border-border p-4">
              <legend className="px-1 text-sm font-medium">Attributswerte</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-3">
                {STATBLOCK_ABILITY_KEYS.map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <Label htmlFor={`statblock-ability-${key}`}>{ABILITY_LABELS[key]}</Label>
                    <Input
                      id={`statblock-ability-${key}`}
                      type="number"
                      min={0}
                      max={40}
                      value={draft.abilities[key]}
                      onChange={(event) => updateAbility(key, event.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Mod {formatAbilityModifier(draft.abilities[key])}
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-saves">Rettungswürfe</Label>
                <Input id="statblock-saves" type="text" value={draft.saves} onChange={(event) => updateDraft({ saves: event.target.value })} placeholder="z. B. Dex +4, Con +2" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-skills">Fertigkeiten</Label>
                <Input id="statblock-skills" type="text" value={draft.skills} onChange={(event) => updateDraft({ skills: event.target.value })} placeholder="z. B. Stealth +6, Perception +3" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-senses">Sinne</Label>
                <Input id="statblock-senses" type="text" value={draft.senses} onChange={(event) => updateDraft({ senses: event.target.value })} placeholder="z. B. darkvision 60 ft., passive Perception 9" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statblock-languages">Sprachen</Label>
                <Input id="statblock-languages" type="text" value={draft.languages} onChange={(event) => updateDraft({ languages: event.target.value })} placeholder="z. B. Common, Goblin" />
              </div>
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
              <p className="text-xs text-muted-foreground">
                {extrasCount} zusätzliche{extrasCount === 1 ? "s" : ""} JSON-Feld
                {extrasCount === 1 ? "" : "er"} (z. B. aus Import) bleib
                {extrasCount === 1 ? "t" : "en"} beim Speichern erhalten — bearbeitbar im
                JSON-Modus.
              </p>
            )}

            {formErrors.length > 0 && (
              <Alert tone="danger" role="alert">
                <ul className="list-disc pl-5">
                  {formErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="statblock-json">Statblock JSON</Label>
              <Textarea
                id="statblock-json"
                rows={16}
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                spellCheck={false}
              />
            </div>
            {jsonParsed == null && (
              <Alert tone="danger" role="alert">
                Ungültiges JSON — Speichern und Export sind deaktiviert.
              </Alert>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canSave || busy} onClick={() => void saveStatblock()}>
            {busy ? "Speichere…" : "Statblock speichern"}
          </Button>
          {exports && (
            <>
              <Button type="button" variant="secondary" onClick={() => void copyExport("JSON", exports.json)}>
                JSON kopieren
              </Button>
              <Button type="button" variant="secondary" onClick={() => void copyExport("Homebrewery", exports.homebrewery)}>
                Homebrewery kopieren
              </Button>
              <Button type="button" variant="secondary" onClick={() => void copyExport("5e.tools JSON", exports.fiveTools)}>
                5e.tools JSON kopieren
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void createStatblockLabel()}>
                {busy ? "Erstelle Label…" : "6×4-Label erstellen"}
              </Button>
            </>
          )}
        </div>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </CardContent>
    </Card>
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
    <fieldset className="rounded-[var(--radius)] border border-border p-4">
      <legend className="px-1 text-sm font-medium">{config.title}</legend>
      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground">Keine Einträge.</p>
        )}
        {entries.map((entry, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="text"
              value={entry.name}
              onChange={(event) => updateEntry(index, { name: event.target.value })}
              placeholder="Name"
              aria-label={`${config.title} — Name`}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeEntry(index)}
              aria-label={`${config.title} — Eintrag entfernen`}
            >
              Entfernen
            </Button>
            <Textarea
              rows={2}
              value={entry.desc}
              onChange={(event) => updateEntry(index, { desc: event.target.value })}
              placeholder="Beschreibung"
              aria-label={`${config.title} — Beschreibung`}
              className="col-span-2"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...entries, { name: "", desc: "" }])}
          className="self-start"
        >
          {config.addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
