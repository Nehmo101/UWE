"use client";

import { useState } from "react";
import type { PortalTableNote } from "@uwe/player-hub";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

/**
 * Notizen im Tischmodus — die einzige Stelle, an der offline geschrieben wird.
 *
 * Geschrieben wird in die lokale Warteschlange, nicht zum Server. Was noch
 * wartet, ist als solches gekennzeichnet: niemand soll glauben, eine Notiz sei
 * angekommen, solange sie nur im Telefon liegt.
 */

interface Props {
  notes: readonly PortalTableNote[];
  canWrite: boolean;
  onCreate: (content: string) => Promise<void>;
  onUpdate: (note: PortalTableNote, content: string) => Promise<void>;
}

export function NotesOffline({ notes, canWrite, onCreate, onUpdate }: Props) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const content = draft.trim();
    if (!content || busy) return;

    setBusy(true);
    try {
      await onCreate(content);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(note: PortalTableNote) {
    const content = editDraft.trim();
    if (!content || busy) return;

    setBusy(true);
    try {
      await onUpdate(note, content);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Neue Notiz</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <textarea
              className="min-h-24 w-full rounded-[var(--radius)] border border-border bg-transparent p-2 text-sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Was am Tisch passiert ist …"
            />
            <div>
              <Button type="button" size="sm" onClick={handleCreate} disabled={busy || !draft.trim()}>
                Notieren
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Notizen in dieser Welt.</p>
      ) : null}

      {notes.map((note) => (
        <Card key={note.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">{note.authorDisplayName}</CardTitle>
            {note.pending ? <Badge variant="warning">wartet auf Netz</Badge> : null}
          </CardHeader>
          <CardContent className="grid gap-2">
            {editingId === note.id ? (
              <>
                <textarea
                  className="min-h-24 w-full rounded-[var(--radius)] border border-border bg-transparent p-2 text-sm"
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleUpdate(note)}
                    disabled={busy || !editDraft.trim()}
                  >
                    Übernehmen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                  >
                    Abbrechen
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                {note.own && canWrite ? (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditDraft(note.content);
                      }}
                    >
                      Bearbeiten
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
