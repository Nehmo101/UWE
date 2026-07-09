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

export function ShoppingListOfflinePanel({ listId, items }: Props) {
  const [online, setOnline] = useState(true);
  const [offlineChecked, setOfflineChecked] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

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

  async function toggleOffline(itemId: string) {
    const nextChecked = !offlineChecked[itemId];
    const next = { ...offlineChecked, [itemId]: nextChecked };
    setOfflineChecked(next);
    window.localStorage.setItem(cacheKey(listId), JSON.stringify(next));

    if (!online) {
      setStatus("Offline gespeichert — wird synchronisiert, sobald die Verbindung steht.");
      return;
    }

    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("listId", listId);
    try {
      await toggleShoppingItemAction(formData);
      setStatus(null);
    } catch {
      setStatus("Sync fehlgeschlagen — lokaler Stand bleibt erhalten.");
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <p className="uwe-dashboard-muted" style={{ fontSize: "0.85rem" }}>
      {!online ? (
        <>
          <strong>Offline-Modus:</strong> Abhaken wird lokal zwischengespeichert.
          {Object.entries(offlineChecked).map(([itemId, checked]) => {
            const serverItem = items.find((item) => item.id === itemId);
            if (!serverItem || serverItem.checked === checked) return null;
            return (
              <button
                key={itemId}
                type="button"
                className="uwe-v2-btn uwe-v2-btn-small"
                style={{ marginLeft: "0.5rem" }}
                onClick={() => void toggleOffline(itemId)}
              >
                Sync {serverItem.name}
              </button>
            );
          })}
        </>
      ) : (
        <>Einkaufsliste wird lokal zwischengespeichert für kurze Offline-Phasen.</>
      )}
      {status ? <> {status}</> : null}
    </p>
  );
}
