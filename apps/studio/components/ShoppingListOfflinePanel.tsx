"use client";

import { useEffect, useState } from "react";
import { toggleShoppingItemAction } from "@/app/kitchen-actions";

interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

interface Props {
  listId: string;
  items: ShoppingItem[];
}

function cacheKey(listId: string): string {
  return `uwe:shopping-offline:${listId}`;
}

function pendingKey(listId: string): string {
  return `uwe:shopping-offline-pending:${listId}`;
}

export function ShoppingListOfflinePanel({ listId, items }: Props) {
  const [online, setOnline] = useState(true);
  const [offlineChecked, setOfflineChecked] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cacheKey(listId));
      if (!raw) {
        const initial: Record<string, boolean> = {};
        for (const item of items) initial[item.id] = item.checked;
        window.localStorage.setItem(cacheKey(listId), JSON.stringify(initial));
        setOfflineChecked(initial);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const merged: Record<string, boolean> = {};
      for (const item of items) {
        merged[item.id] = parsed[item.id] ?? item.checked;
      }
      setOfflineChecked(merged);
      window.localStorage.setItem(cacheKey(listId), JSON.stringify(merged));
    } catch {
      // ignore cache errors
    }
  }, [items, listId]);

  async function syncItem(itemId: string, targetChecked: boolean) {
    const serverItem = items.find((item) => item.id === itemId);
    if (!serverItem || serverItem.checked === targetChecked) {
      return;
    }
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("listId", listId);
    await toggleShoppingItemAction(formData);
  }

  async function replayPending() {
    if (syncing) return;
    setSyncing(true);
    try {
      let pending: Record<string, boolean> = {};
      try {
        const raw = window.localStorage.getItem(pendingKey(listId));
        pending = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        pending = {};
      }

      const mergedPending = { ...pending };
      for (const item of items) {
        const localChecked = offlineChecked[item.id];
        if (localChecked !== undefined && localChecked !== item.checked) {
          mergedPending[item.id] = localChecked;
        }
      }

      const entries = Object.entries(mergedPending);
      if (entries.length === 0) {
        setStatus(null);
        return;
      }

      for (const [itemId, checked] of entries) {
        await syncItem(itemId, checked);
        delete mergedPending[itemId];
        window.localStorage.setItem(pendingKey(listId), JSON.stringify(mergedPending));
      }

      window.localStorage.removeItem(pendingKey(listId));
      setStatus("Offline-Änderungen synchronisiert.");
    } catch {
      setStatus("Sync fehlgeschlagen — lokaler Stand bleibt erhalten.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!online) return;
    void replayPending();
    // Replay only when connectivity returns — not on every checkbox change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, listId]);

  async function toggleOffline(itemId: string) {
    const nextChecked = !offlineChecked[itemId];
    const next = { ...offlineChecked, [itemId]: nextChecked };
    setOfflineChecked(next);
    window.localStorage.setItem(cacheKey(listId), JSON.stringify(next));

    if (!online) {
      const pendingRaw = window.localStorage.getItem(pendingKey(listId));
      const pending = pendingRaw ? (JSON.parse(pendingRaw) as Record<string, boolean>) : {};
      pending[itemId] = nextChecked;
      window.localStorage.setItem(pendingKey(listId), JSON.stringify(pending));
      setStatus("Offline gespeichert — wird synchronisiert, sobald die Verbindung steht.");
      return;
    }

    try {
      await syncItem(itemId, nextChecked);
      setStatus(null);
    } catch {
      const pendingRaw = window.localStorage.getItem(pendingKey(listId));
      const pending = pendingRaw ? (JSON.parse(pendingRaw) as Record<string, boolean>) : {};
      pending[itemId] = nextChecked;
      window.localStorage.setItem(pendingKey(listId), JSON.stringify(pending));
      setStatus("Sync fehlgeschlagen — lokaler Stand bleibt erhalten.");
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground" style={{ fontSize: "0.85rem" }}>
      {!online ? (
        <>
          <strong>Offline-Modus:</strong> Abhaken wird lokal zwischengespeichert und beim
          Reconnect automatisch synchronisiert.
        </>
      ) : syncing ? (
        <>Synchronisiere Offline-Änderungen…</>
      ) : (
        <>Einkaufsliste wird lokal zwischengespeichert für kurze Offline-Phasen.</>
      )}
      {Object.entries(offlineChecked).map(([itemId, checked]) => {
        const serverItem = items.find((item) => item.id === itemId);
        if (!serverItem || serverItem.checked === checked) return null;
        return (
          <button
            key={itemId}
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-muted h-8 px-3 text-xs"
            style={{ marginLeft: "0.5rem" }}
            onClick={() => void toggleOffline(itemId)}
          >
            Sync {serverItem.name}
          </button>
        );
      })}
      {status ? <> {status}</> : null}
    </p>
  );
}
