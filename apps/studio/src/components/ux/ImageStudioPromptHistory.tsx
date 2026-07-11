"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/src/components/ui";

const STORAGE_PREFIX = "uwe:image-studio:prompts:";

export function ImageStudioPromptHistory({ projectId }: { projectId: string }) {
  const storageKey = `${STORAGE_PREFIX}${projectId}`;
  const [history, setHistory] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((entry): entry is string => typeof entry === "string"));
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, [storageKey]);

  function persist(entries: string[]) {
    setHistory(entries);
    localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, 20)));
  }

  function saveDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next = [trimmed, ...history.filter((entry) => entry !== trimmed)].slice(0, 20);
    persist(next);
    setDraft("");
  }

  function removeEntry(entry: string) {
    persist(history.filter((item) => item !== entry));
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prompt-Verlauf (lokal)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Noch keine Prompts gespeichert — füge einen hinzu.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Prompt merken…"
              className="flex-1"
            />
            <Button type="button" variant="secondary" size="sm" onClick={saveDraft}>
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt-Verlauf (lokal)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry} className="flex flex-wrap items-center gap-2">
              <code className="flex-1 whitespace-pre-wrap text-sm">{entry}</code>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(entry)}>
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Prompt merken…"
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={saveDraft}>
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
