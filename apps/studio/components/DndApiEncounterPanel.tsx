"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { worldWikiPath } from "@/src/lib/world-last-route";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EncounterBudgetSummary } from "@/components/EncounterBudgetSummary";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

export interface DndApiSearchItem {
  provider: string;
  id: string;
  name: string;
  url: string;
  summary?: string;
}

interface DndApiEncounterPanelProps {
  worldSlug: string;
  results: DndApiSearchItem[];
}

interface EncounterMonster {
  name: string;
  cr?: string;
  slug: string;
  count?: number;
}

type GeneratorDifficulty = "easy" | "medium" | "hard" | "deadly";
type GeneratorStyle = "boss" | "horde" | "mixed";

interface PanelMessage {
  text: string;
  tone: "success" | "error";
}

const DIFFICULTY_LABELS: Record<GeneratorDifficulty, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer",
  deadly: "Tödlich",
};

const STYLE_LABELS: Record<GeneratorStyle, string> = {
  mixed: "Gemischt (Anführer + Begleiter)",
  boss: "Boss (+ wenige Begleiter)",
  horde: "Horde (viele gleiche Gegner)",
};

/** TODO(design-kit): Controlled Selects ohne Leerwert (Schwierigkeit/Stil) — Kit-Select folgt später. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function extractCrFromSummary(summary?: string): string | undefined {
  if (!summary) {
    return undefined;
  }
  const match = summary.match(/CR\s*([0-9/]+)/i);
  return match?.[1];
}

export function DndApiEncounterPanel({ worldSlug, results }: DndApiEncounterPanelProps) {
  const router = useRouter();
  const open5eMonsters = useMemo(
    () => results.filter((item) => item.provider === "open5e"),
    [results],
  );
  const [selected, setSelected] = useState<EncounterMonster[]>([]);
  const [encounterTitle, setEncounterTitle] = useState("Encounter");
  const [partyLevel, setPartyLevel] = useState(5);
  const [partySize, setPartySize] = useState(4);
  const [difficulty, setDifficulty] = useState<GeneratorDifficulty>("medium");
  const [style, setStyle] = useState<GeneratorStyle>("mixed");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<PanelMessage | null>(null);

  function toggleMonster(item: DndApiSearchItem) {
    setSelected((current) => {
      const exists = current.some((monster) => monster.slug === item.id);
      if (exists) {
        return current.filter((monster) => monster.slug !== item.id);
      }
      return [
        ...current,
        {
          name: item.name,
          slug: item.id,
          cr: extractCrFromSummary(item.summary),
          count: 1,
        },
      ];
    });
  }

  function updateMonsterCr(slug: string, cr: string) {
    setSelected((current) =>
      current.map((monster) => (monster.slug === slug ? { ...monster, cr } : monster)),
    );
  }

  function updateMonsterCount(slug: string, count: number) {
    setSelected((current) =>
      current.map((monster) =>
        monster.slug === slug
          ? { ...monster, count: Math.min(24, Math.max(1, Math.round(count) || 1)) }
          : monster,
      ),
    );
  }

  async function importStatblock(item: DndApiSearchItem) {
    setBusy(`import-${item.id}`);
    setMessage(null);
    try {
      const response = await fetch(studioApiUrl("/api/dnd-api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_statblock",
          worldSlug,
          slug: item.id,
          title: item.name,
        }),
      });
      const data = (await response.json()) as { error?: string; editHref?: string };
      if (!response.ok) throw new Error(data.error ?? "Import fehlgeschlagen.");
      setMessage({ text: `Statblock importiert: ${item.name}`, tone: "success" });
      if (data.editHref) {
        router.push(data.editHref);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Import fehlgeschlagen.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function generateEncounter() {
    setBusy("generate");
    setMessage(null);
    try {
      const response = await fetch(studioApiUrl("/api/dnd-api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_encounter",
          worldSlug,
          partyLevel,
          partySize,
          difficulty,
          style,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        composition?: {
          monsters: Array<{ name: string; slug: string; cr: string; count: number }>;
        };
      };
      if (!response.ok) throw new Error(data.error ?? "Generierung fehlgeschlagen.");

      const monsters = data.composition?.monsters ?? [];
      if (monsters.length === 0) {
        setMessage({ text: "Kein passendes Encounter gefunden — Parameter anpassen.", tone: "error" });
        return;
      }
      setSelected(monsters);
      setEncounterTitle(
        `${DIFFICULTY_LABELS[difficulty]}es Encounter (Level ${partyLevel})`,
      );
      setMessage({ text: "Vorschlag übernommen — Auswahl unten anpassen oder direkt speichern.", tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Generierung fehlgeschlagen.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function createEncounter() {
    if (selected.length === 0) {
      setMessage({ text: "Mindestens ein Monster auswählen.", tone: "error" });
      return;
    }
    setBusy("encounter");
    setMessage(null);
    try {
      const response = await fetch(studioApiUrl("/api/dnd-api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_encounter",
          worldSlug,
          title: encounterTitle,
          partyLevel,
          partySize,
          monsters: selected,
        }),
      });
      const data = (await response.json()) as { error?: string; editHref?: string };
      if (!response.ok) throw new Error(data.error ?? "Encounter-Erstellung fehlgeschlagen.");
      setMessage({ text: `Encounter erstellt: ${encounterTitle}`, tone: "success" });
      setSelected([]);
      if (data.editHref) {
        router.push(data.editHref);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Encounter-Erstellung fehlgeschlagen.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Encounter Builder (Open5e)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-party-level">Party-Level</Label>
            <Input
              id="encounter-party-level"
              type="number"
              min={1}
              max={20}
              value={partyLevel}
              onChange={(event) => setPartyLevel(Number(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-party-size">Gruppengröße</Label>
            <Input
              id="encounter-party-size"
              type="number"
              min={1}
              max={10}
              value={partySize}
              onChange={(event) => setPartySize(Number(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-difficulty">Schwierigkeit</Label>
            <select
              id="encounter-difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as GeneratorDifficulty)}
              className={NATIVE_SELECT_CLASS}
            >
              {(Object.keys(DIFFICULTY_LABELS) as GeneratorDifficulty[]).map((key) => (
                <option key={key} value={key}>
                  {DIFFICULTY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-style">Stil</Label>
            <select
              id="encounter-style"
              value={style}
              onChange={(event) => setStyle(event.target.value as GeneratorStyle)}
              className={NATIVE_SELECT_CLASS}
            >
              {(Object.keys(STYLE_LABELS) as GeneratorStyle[]).map((key) => (
                <option key={key} value={key}>
                  {STYLE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={busy === "generate"}
          onClick={() => void generateEncounter()}
          className="self-start"
        >
          {busy === "generate" ? "Würfle Encounter…" : "Encounter generieren (XP-Budget)"}
        </Button>

        {open5eMonsters.length > 0 && (
          <ul className="grid gap-2">
            {open5eMonsters.map((item) => {
              const isSelected = selected.some((monster) => monster.slug === item.id);
              return (
                <li key={item.id}>
                  <Card className="p-4">
                    <strong>{item.name}</strong>
                    {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy === `import-${item.id}`}
                        onClick={() => void importStatblock(item)}
                      >
                        {busy === `import-${item.id}` ? "Import…" : "Als Seite importieren"}
                      </Button>
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "ghost"}
                        onClick={() => toggleMonster(item)}
                      >
                        {isSelected ? "Im Encounter" : "Zum Encounter"}
                      </Button>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        API
                      </a>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {selected.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Wähle Monster aus den Suchergebnissen aus, um ein Encounter zu erstellen.
          </p>
        )}

        {selected.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-title">Encounter-Titel</Label>
            <Input
              id="encounter-title"
              value={encounterTitle}
              onChange={(event) => setEncounterTitle(event.target.value)}
            />
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Ausgewählte Monster</h3>
            <ul className="grid gap-2">
              {selected.map((monster) => (
                <li key={monster.slug}>
                  <Card className="p-4">
                    <strong>{monster.name}</strong>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`encounter-monster-cr-${monster.slug}`}>CR</Label>
                        <Input
                          id={`encounter-monster-cr-${monster.slug}`}
                          value={monster.cr ?? ""}
                          placeholder="z. B. 1/2"
                          onChange={(event) => updateMonsterCr(monster.slug, event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`encounter-monster-count-${monster.slug}`}>Anzahl</Label>
                        <Input
                          id={`encounter-monster-count-${monster.slug}`}
                          type="number"
                          min={1}
                          max={24}
                          value={monster.count ?? 1}
                          onChange={(event) =>
                            updateMonsterCount(monster.slug, Number(event.target.value))
                          }
                        />
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selected.length > 0 && (
          <>
            <EncounterBudgetSummary
              partyLevel={partyLevel}
              partySize={partySize}
              monsters={selected.map((monster) => ({ cr: monster.cr, count: monster.count ?? 1 }))}
            />

            <Button
              type="button"
              disabled={busy === "encounter"}
              onClick={() => void createEncounter()}
              className="self-start"
            >
              {busy === "encounter" ? "Erstelle…" : "Encounter-Seite erstellen"}
            </Button>
          </>
        )}

        {message && (
          <Alert
            tone={message.tone === "error" ? "danger" : "success"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          Statblocks werden als UWE-Seiten mit Markdown-Inhalt angelegt. Bearbeiten unter{" "}
          <Link href={worldWikiPath(worldSlug)}>Seitenliste</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
