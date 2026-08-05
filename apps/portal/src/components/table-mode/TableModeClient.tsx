"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  mergeNotesWithQueue,
  type OfflineNoteOperation,
  type PortalOfflineSnapshot,
  type PortalTableNote,
} from "@uwe/player-hub";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { CharacterCard } from "./CharacterCard";
import { NotesOffline } from "./NotesOffline";
import { TreasuryCard } from "./TreasuryCard";
import {
  enqueueOperation,
  isOfflineStoreAvailable,
  listSnapshots,
  readQueue,
  readSnapshot,
} from "./offline-store";
import { fetchSnapshot, flushQueue, newClientRef } from "./sync-runner";

/**
 * Tischmodus — das Portal, wenn kein Netz da ist.
 *
 * Alles auf dieser Seite kommt aus dem lokalen Speicher; die Seite selbst
 * liefert serverseitig keine Inhalte aus (nur so darf ihre Hülle im
 * Service-Worker-Cache liegen). Beim Öffnen mit Netz wird der Abzug erneuert
 * und die Warteschlange abgeschickt.
 */

const DATE_TIME = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function subscribeNever(): () => void {
  return () => {};
}

/**
 * Netzzustand über `useSyncExternalStore` statt über einen Effekt: der Browser
 * *ist* der externe Zustand. Serverseitig gilt „verbunden" — sonst blitzte beim
 * Hydratisieren kurz ein falsches „offline" auf.
 */
function useOnlineState(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

/** Ob der Browser überhaupt etwas aufbewahren kann (privater Modus, alte Fassungen). */
function useOfflineStoreAvailable(): boolean {
  return useSyncExternalStore(subscribeNever, isOfflineStoreAvailable, () => true);
}

export function TableModeClient() {
  const params = useSearchParams();
  const requestedWorld = params?.get("welt") ?? null;
  const online = useOnlineState();
  const storeAvailable = useOfflineStoreAvailable();

  const [worlds, setWorlds] = useState<{ slug: string; name: string }[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(requestedWorld);
  const [snapshot, setSnapshot] = useState<PortalOfflineSnapshot | null>(null);
  const [queue, setQueue] = useState<OfflineNoteOperation[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadLocal = useCallback(async (slug: string | null) => {
    const cached = await listSnapshots();
    setWorlds(cached.map((entry) => ({ slug: entry.world.slug, name: entry.world.name })));

    const target = slug ?? cached[0]?.world.slug ?? null;
    setActiveSlug(target);

    if (!target) {
      setSnapshot(null);
      setQueue([]);
      return;
    }

    setSnapshot(await readSnapshot(target));
    setQueue(await readQueue(target));
  }, []);

  // Erst den lokalen Bestand zeigen, dann — wenn Netz da ist — auffrischen.
  // Umgekehrt sähe der Tisch beim Start eine leere Seite.
  useEffect(() => {
    if (!isOfflineStoreAvailable()) return;
    // IndexedDB ist der externe Zustand, mit dem dieser Effekt die Anzeige
    // synchronisiert — das Setzen ist hier der Zweck, nicht der Nebeneffekt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadLocal(requestedWorld);
  }, [reloadLocal, requestedWorld]);

  const refresh = useCallback(
    async (slug: string) => {
      setBusy(true);
      setStatus(null);
      try {
        const outcome = await flushQueue(slug);
        await fetchSnapshot(slug);
        await reloadLocal(slug);

        if (outcome.conflicts.length > 0) {
          setStatus(
            `${outcome.conflicts.length} Notiz(en) wurden anderswo geändert — deine Fassung liegt jetzt als neue Notiz bereit.`,
          );
        } else if (outcome.denied.length > 0) {
          setStatus(`${outcome.denied.length} Eintrag/Einträge wurden abgelehnt.`);
        } else if (outcome.applied.length > 0) {
          setStatus(`${outcome.applied.length} Notiz(en) übertragen.`);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Aktualisieren fehlgeschlagen.");
      } finally {
        setBusy(false);
      }
    },
    [reloadLocal],
  );

  useEffect(() => {
    if (!online || !activeSlug) return;
    // Der Effekt darf hier setzen: „gleicht ab …" ist genau das, was er
    // anzeigen soll, während er die Welt mit dem Server abgleicht.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(activeSlug);
  }, [online, activeSlug, refresh]);

  const notes = useMemo<PortalTableNote[]>(() => {
    if (!snapshot) return [];
    return mergeNotesWithQueue(snapshot.notes, queue, {
      viewerUserId: snapshot.viewerUserId,
      viewerDisplayName: "Ich",
    });
  }, [snapshot, queue]);

  const addToQueue = useCallback(
    async (operation: OfflineNoteOperation) => {
      if (!activeSlug) return;
      await enqueueOperation(activeSlug, operation);
      setQueue(await readQueue(activeSlug));
      if (online) void refresh(activeSlug);
    },
    [activeSlug, online, refresh],
  );

  const handleCreate = useCallback(
    async (content: string) => {
      if (!snapshot) return;
      // Neue Notizen hängen an der aktiven Session des Abzugs — dadurch stimmt
      // auch die Kampagne. Ältere Abzüge ohne activeSession fallen auf die
      // Welt-Kampagne zurück (Notiz ohne Session-Bezug).
      const activeSession = snapshot.activeSession ?? null;
      const campaignId = activeSession?.campaignId ?? snapshot.campaignId;
      if (!campaignId) return;
      await addToQueue({
        op: "create",
        clientRef: newClientRef(),
        campaignId,
        content,
        pageId: null,
        gameSessionId: activeSession?.id ?? null,
        clientUpdatedAt: new Date().toISOString(),
      });
    },
    [addToQueue, snapshot],
  );

  const handleUpdate = useCallback(
    async (note: PortalTableNote, content: string) => {
      await addToQueue({
        op: "update",
        clientRef: note.clientRef ?? newClientRef(),
        campaignId: note.campaignId,
        noteId: note.id,
        content,
        baseUpdatedAt: note.pending ? null : note.updatedAt,
        clientUpdatedAt: new Date().toISOString(),
      });
    },
    [addToQueue],
  );

  if (!snapshot) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {storeAvailable
            ? "Für den Tischmodus muss eine Welt einmal mit Netz geladen werden. Öffne dazu deine Welt im Portal und tippe dort auf „Tischmodus“ — danach steht sie hier auch ohne Verbindung."
            : "Dieser Browser kann nichts offline aufbewahren — im privaten Modus bleibt der Tischmodus leer."}
        </p>
        {status ? <p className="text-sm text-destructive">{status}</p> : null}
        <div>
          <Link href="/auth/worlds" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Zu meinen Welten
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = queue.length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={online ? "success" : "warning"}>{online ? "verbunden" : "offline"}</Badge>
        <span className="text-sm text-muted-foreground">
          Stand: {DATE_TIME.format(new Date(snapshot.snapshotAt))}
        </span>
        {pendingCount > 0 ? <Badge variant="info">{pendingCount} wartet</Badge> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!online || busy}
          onClick={() => activeSlug && refresh(activeSlug)}
        >
          {busy ? "Gleicht ab …" : "Aktualisieren"}
        </Button>
      </div>

      {worlds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {worlds.map((world) => (
            <Button
              key={world.slug}
              type="button"
              size="sm"
              variant={world.slug === activeSlug ? "default" : "outline"}
              onClick={() => void reloadLocal(world.slug)}
            >
              {world.name}
            </Button>
          ))}
        </div>
      ) : null}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <Tabs defaultValue="charakter">
        <TabsList>
          <TabsTrigger value="charakter">Charakter</TabsTrigger>
          <TabsTrigger value="notizen">Notizen</TabsTrigger>
          <TabsTrigger value="inventar">Inventar</TabsTrigger>
        </TabsList>

        <TabsContent value="charakter" className="grid gap-3">
          {snapshot.characters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kein Charakterbogen im Abzug.</p>
          ) : (
            snapshot.characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))
          )}
        </TabsContent>

        <TabsContent value="notizen">
          <NotesOffline
            notes={notes}
            canWrite={Boolean(snapshot.campaignId)}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
          />
        </TabsContent>

        <TabsContent value="inventar">
          <TreasuryCard treasury={snapshot.treasury} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
