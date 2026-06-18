"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
}

export function DndApiEncounterPanel({ worldSlug, results }: DndApiEncounterPanelProps) {
  const router = useRouter();
  const open5eMonsters = useMemo(
    () => results.filter((item) => item.provider === "open5e"),
    [results],
  );
  const [selected, setSelected] = useState<EncounterMonster[]>([]);
  const [encounterTitle, setEncounterTitle] = useState("Encounter");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function toggleMonster(item: DndApiSearchItem) {
    setSelected((current) => {
      const exists = current.some((monster) => monster.slug === item.id);
      if (exists) {
        return current.filter((monster) => monster.slug !== item.id);
      }
      return [...current, { name: item.name, slug: item.id }];
    });
  }

  async function importStatblock(item: DndApiSearchItem) {
    setBusy(`import-${item.id}`);
    setMessage(null);
    try {
      const response = await fetch("/api/dnd-api", {
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
      setMessage(`Statblock importiert: ${item.name}`);
      if (data.editHref) {
        router.push(data.editHref);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function createEncounter() {
    if (selected.length === 0) {
      setMessage("Mindestens ein Monster auswählen.");
      return;
    }
    setBusy("encounter");
    setMessage(null);
    try {
      const response = await fetch("/api/dnd-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_encounter",
          worldSlug,
          title: encounterTitle,
          monsters: selected,
        }),
      });
      const data = (await response.json()) as { error?: string; editHref?: string };
      if (!response.ok) throw new Error(data.error ?? "Encounter-Erstellung fehlgeschlagen.");
      setMessage(`Encounter erstellt: ${encounterTitle}`);
      setSelected([]);
      if (data.editHref) {
        router.push(data.editHref);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Encounter-Erstellung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  if (open5eMonsters.length === 0 && selected.length === 0) {
    return null;
  }

  return (
    <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
      <h2>Encounter Builder (Open5e)</h2>
      {open5eMonsters.length > 0 && (
        <ul className="uwe-list-cards">
          {open5eMonsters.map((item) => {
            const isSelected = selected.some((monster) => monster.slug === item.id);
            return (
              <li key={item.id} className="uwe-list-card">
                <strong>{item.name}</strong>
                {item.summary && <p className="uwe-dashboard-muted">{item.summary}</p>}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="uwe-btn uwe-btn-ghost"
                    disabled={busy === `import-${item.id}`}
                    onClick={() => void importStatblock(item)}
                  >
                    {busy === `import-${item.id}` ? "Import…" : "Als Seite importieren"}
                  </button>
                  <button
                    type="button"
                    className={`uwe-btn ${isSelected ? "uwe-btn-primary" : "uwe-btn-ghost"}`}
                    onClick={() => toggleMonster(item)}
                  >
                    {isSelected ? "Im Encounter" : "Zum Encounter"}
                  </button>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    API
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <label style={{ marginTop: "1rem" }}>
        Encounter-Titel
        <input value={encounterTitle} onChange={(event) => setEncounterTitle(event.target.value)} />
      </label>

      {selected.length > 0 && (
        <p className="uwe-hint">
          Ausgewählt: {selected.map((monster) => monster.name).join(", ")}
        </p>
      )}

      <button
        type="button"
        className="uwe-btn uwe-btn-primary"
        disabled={busy === "encounter" || selected.length === 0}
        onClick={() => void createEncounter()}
      >
        {busy === "encounter" ? "Erstelle…" : "Encounter-Seite erstellen"}
      </button>

      {message && <p className="uwe-notice">{message}</p>}
      <p className="uwe-hint">
        Statblocks werden als UWE-Seiten mit Markdown-Inhalt angelegt. Bearbeiten unter{" "}
        <Link href={`/worlds/${worldSlug}`}>Seitenliste</Link>.
      </p>
    </section>
  );
}
