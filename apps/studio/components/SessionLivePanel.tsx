"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendSessionLiveEntryAction,
  deleteSessionLiveEntryAction,
  endSessionLiveModeAction,
  updateSessionLiveNotesAction,
} from "@/app/session-live-actions";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface LinkedPage {
  id: string;
  title: string;
  href: string;
}

type LiveEntryKind = "note" | "loot" | "quest_update" | "npc_update" | "initiative" | "bookmark";

interface LiveEntryView {
  id: string;
  kind: LiveEntryKind;
  kindLabel: string;
  content: string;
  time: string;
  refHref: string | null;
  refTitle: string | null;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  sessionTitle: string;
  initialNotes: string;
  linkedPages: LinkedPage[];
  entries: LiveEntryView[];
}

/**
 * Die Nachbereitung wertet `loot`, `quest_update` und `bookmark` aus, das
 * Live-Panel konnte sie aber nie erfassen (siehe ui-assessment.md). Damit
 * standen im Review Spalten, die nie etwas enthalten konnten.
 */
const ENTRY_KINDS: { value: LiveEntryKind; label: string; needsRef: boolean }[] = [
  { value: "note", label: "Notiz", needsRef: false },
  { value: "npc_update", label: "NPC-Update", needsRef: true },
  { value: "quest_update", label: "Quest-Update", needsRef: true },
  { value: "loot", label: "Beute", needsRef: false },
  { value: "initiative", label: "Initiative", needsRef: false },
  { value: "bookmark", label: "Lesezeichen", needsRef: true },
];

function liveTimerStorageKey(sessionId: string): string {
  return `uwe:live-timer:${sessionId}`;
}

function readLiveTimerStart(sessionId: string): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = localStorage.getItem(liveTimerStorageKey(sessionId));
    if (raw) {
      const parsed = JSON.parse(raw) as { startedAt?: number };
      if (typeof parsed.startedAt === "number") return parsed.startedAt;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const startedAt = Date.now();
  localStorage.setItem(liveTimerStorageKey(sessionId), JSON.stringify({ startedAt }));
  return startedAt;
}

function clearLiveTimer(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(liveTimerStorageKey(sessionId));
  } catch {
    /* ignore */
  }
}

/** Native select styling — beide Selects sind Client-State-gesteuert (kind,
 * refPageId) bzw. brauchen einen echten Leerwert; Kit-Select (Radix) passt
 * hier nicht ohne Zusatz-Wiring. Siehe TODO(design-kit) unten. */
const SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SessionLivePanel({
  worldSlug,
  sessionId,
  sessionTitle,
  initialNotes,
  linkedPages,
  entries,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<LiveEntryKind>("note");
  const [content, setContent] = useState("");
  const [refPageId, setRefPageId] = useState("");
  const [startedAt] = useState(() => readLiveTimerStart(sessionId));
  const [elapsedMinutes, setElapsedMinutes] = useState(() =>
    Math.floor((Date.now() - startedAt) / 60_000),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60_000));
    }, 30_000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsedLabel = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;
  }, [elapsedMinutes]);

  const activeKind = useMemo(() => ENTRY_KINDS.find((k) => k.value === kind), [kind]);

  const scheduleSave = useCallback(
    (nextNotes: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateSessionLiveNotesAction({ worldSlug, sessionId, notes: nextNotes }).then(() => {
          setStatus("Automatisch gespeichert.");
        });
      }, 1200);
    },
    [sessionId, worldSlug],
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      scheduleSave(value);
    },
    [scheduleSave],
  );

  async function handleAddEntry() {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    setStatus(null);
    try {
      await appendSessionLiveEntryAction({
        worldSlug,
        sessionId,
        kind,
        content: text,
        refPageId: activeKind?.needsRef && refPageId ? refPageId : null,
      });
      setContent("");
      setRefPageId("");
      setStatus("Eintrag vorgemerkt.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Eintrag fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    setBusy(true);
    try {
      await deleteSessionLiveEntryAction({ worldSlug, sessionId, entryId });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Live-Dauer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{elapsedLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Vorgemerkte Einträge</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Verknüpfte Seiten</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{linkedPages.length}</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Live-Modus für {sessionTitle} — Einträge werden nur vorgemerkt. Am Ende
        („Live beenden“) prüfst du sie und übernimmst sie bewusst in den Kanon.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Ereignis vormerken</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-live-kind">Typ</Label>
            {/* TODO(design-kit): natives Select statt Kit-Select — Client-State (kind)
                ohne FormData-Bindung, siehe SELECT_CLASS oben. */}
            <select
              id="session-live-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as LiveEntryKind)}
              className={SELECT_CLASS}
            >
              {ENTRY_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {activeKind?.needsRef && linkedPages.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-live-ref-page">Seite</Label>
              {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value=""
                  für "— keine —" ohne Zusatz-Wiring — natives Select beibehalten. */}
              <select
                id="session-live-ref-page"
                value={refPageId}
                onChange={(event) => setRefPageId(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">— keine —</option>
                {linkedPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="session-live-content">Inhalt</Label>
            <Input
              id="session-live-content"
              type="text"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddEntry();
                }
              }}
              placeholder="Was ist passiert?"
            />
          </div>
          <Button type="button" disabled={busy || !content.trim()} onClick={() => void handleAddEntry()}>
            + Vormerken
          </Button>
        </div>

        {entries.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">{entry.time}</span>
                <Badge>{entry.kindLabel}</Badge>
                <span className="flex-1">
                  {entry.content}
                  {entry.refHref ? (
                    <>
                      {" "}
                      <Link href={entry.refHref}>({entry.refTitle})</Link>
                    </>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDeleteEntry(entry.id)}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Noch keine Einträge vorgemerkt.</p>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="session-live-notes">Freie Live-Notizen</Label>
        <Textarea
          id="session-live-notes"
          rows={10}
          value={notes}
          onChange={(event) => handleNotesChange(event.target.value)}
          placeholder="Fließtext, der nicht in einen Eintrag passt …"
        />
      </div>

      {status ? <Alert tone="success">{status}</Alert> : null}

      {linkedPages.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">NPC-Schnellzugriff</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {linkedPages.slice(0, 8).map((page) => (
              <li key={page.id}>
                <Link href={page.href}>{page.title}</Link>
              </li>
            ))}
          </ul>
          {linkedPages.length > 8 ? (
            <p className="text-sm text-muted-foreground">
              {linkedPages.length - 8} weitere verknüpfte Seiten im Session-Detail.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/worlds/${worldSlug}/roll-tables`} className={buttonVariants({ variant: "outline" })}>
          Würfeln
        </Link>
        <Link
          href={`/worlds/${worldSlug}/sessions/${sessionId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Session-Detail
        </Link>
        <form
          action={endSessionLiveModeAction}
          onSubmit={() => {
            clearLiveTimer(sessionId);
          }}
        >
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit">Live beenden → Review</Button>
        </form>
      </div>
    </div>
  );
}
