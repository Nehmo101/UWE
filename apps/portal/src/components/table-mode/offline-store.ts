/**
 * Lokaler Speicher des Tischmodus (IndexedDB).
 *
 * Zwei Ablagen: der letzte Abzug je Welt und die Warteschlange der Notizen,
 * die noch nicht beim Server angekommen sind. IndexedDB statt `localStorage`,
 * weil ein Charakterbogen mit Zaubern schnell über dessen Grössengrenze geht
 * und weil hier ohne Umweg über JSON-Zeichenketten geschrieben werden kann.
 *
 * Ohne Fremd-Bibliothek: die vier Zugriffe, die der Tischmodus braucht, sind
 * mit der nackten Schnittstelle kürzer als jede Abhängigkeit.
 */
import type { OfflineNoteOperation, PortalOfflineSnapshot } from "@uwe/player-hub";
import { isUsablePortalOfflineSnapshot } from "@uwe/player-hub";

const DB_NAME = "uwe-portal-tisch";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const QUEUE_STORE = "queue";

interface QueueRow {
  clientRef: string;
  worldSlug: string;
  operation: OfflineNoteOperation;
}

export function isOfflineStoreAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "worldSlug" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "clientRef" });
        store.createIndex("worldSlug", "worldSlug", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function finish<T>(transaction: IDBTransaction, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(value());
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const value = await work(store);
    return await finish(transaction, () => value);
  } finally {
    db.close();
  }
}

interface SnapshotRow {
  worldSlug: string;
  snapshot: PortalOfflineSnapshot;
}

export async function saveSnapshot(snapshot: PortalOfflineSnapshot): Promise<void> {
  await withStore(SNAPSHOT_STORE, "readwrite", (store) => {
    store.put({ worldSlug: snapshot.world.slug, snapshot } satisfies SnapshotRow);
  });
}

/**
 * Gehört dieser Abzug der Person, die gerade angemeldet ist?
 *
 * Ein Portal-Gerät wird herumgereicht. Der Abzug trägt deshalb die
 * `viewerUserId`, für die er gebaut wurde — stimmt sie nicht mit dem aktuellen
 * Konto überein, wird der Eintrag nicht nur ignoriert, sondern GELÖSCHT: Was
 * die vorige Person mitgenommen hat, darf für die nächste nicht auffindbar
 * bleiben. Ein Abzug aus einer älteren Formatfassung fällt mit weg.
 */
function belongsToViewer(
  snapshot: unknown,
  viewerUserId: string | null,
): snapshot is PortalOfflineSnapshot {
  return (
    isUsablePortalOfflineSnapshot(snapshot) && snapshot.viewerUserId === viewerUserId
  );
}

export async function readSnapshot(
  worldSlug: string,
  viewerUserId: string | null,
): Promise<PortalOfflineSnapshot | null> {
  return withStore(SNAPSHOT_STORE, "readwrite", async (store) => {
    const row = await requestResult<SnapshotRow | undefined>(store.get(worldSlug));
    if (!row) return null;
    if (!belongsToViewer(row.snapshot, viewerUserId)) {
      store.delete(worldSlug);
      return null;
    }
    return row.snapshot;
  });
}

export async function listSnapshots(
  viewerUserId: string | null,
): Promise<PortalOfflineSnapshot[]> {
  return withStore(SNAPSHOT_STORE, "readwrite", async (store) => {
    const rows = await requestResult<SnapshotRow[]>(store.getAll());
    const usable: PortalOfflineSnapshot[] = [];
    for (const row of rows) {
      if (belongsToViewer(row.snapshot, viewerUserId)) {
        usable.push(row.snapshot);
      } else {
        store.delete(row.worldSlug);
      }
    }
    return usable.sort((a, b) => a.world.name.localeCompare(b.world.name, "de"));
  });
}

export async function enqueueOperation(
  worldSlug: string,
  operation: OfflineNoteOperation,
): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", (store) => {
    store.put({ clientRef: operation.clientRef, worldSlug, operation } satisfies QueueRow);
  });
}

export async function readQueue(worldSlug: string): Promise<OfflineNoteOperation[]> {
  const rows = await withStore(QUEUE_STORE, "readonly", (store) =>
    requestResult<QueueRow[]>(store.index("worldSlug").getAll(worldSlug)),
  );

  return rows.map((row) => row.operation);
}

/** Ersetzt die Warteschlange einer Welt — das Ergebnis des Abgleichs. */
export async function replaceQueue(
  worldSlug: string,
  operations: readonly OfflineNoteOperation[],
): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", async (store) => {
    const existing = await requestResult<QueueRow[]>(store.index("worldSlug").getAll(worldSlug));
    for (const row of existing) {
      store.delete(row.clientRef);
    }
    for (const operation of operations) {
      store.put({ clientRef: operation.clientRef, worldSlug, operation } satisfies QueueRow);
    }
  });
}

/**
 * Räumt alles weg — beim Abmelden. Ein Portal-Gerät wird herumgereicht; was
 * die vorige Person am Tisch getippt hat, geht die nächste nichts an.
 */
export async function clearOfflineData(): Promise<void> {
  if (!isOfflineStoreAvailable()) return;

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
