"use client";

import { useState } from "react";

interface Props {
  worldSlug: string;
  items: Array<{ id: string; title: string; category: string }>;
  action: (formData: FormData) => Promise<void>;
}

export function OpenItemsBulkClose({ worldSlug, items, action }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) return null;

  return (
    <form action={action} className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Bulk schließen</h2>
      <p className="uwe-dashboard-muted">Offene Quests als erledigt markieren (nur Quest-Kategorie).</p>
      <ul className="auth-page-list">
        {items
          .filter((item) => item.category === "open_quest")
          .map((item) => (
            <li key={item.id}>
              <label className="uwe-checkbox-label">
                <input
                  type="checkbox"
                  name="itemIds"
                  value={item.id}
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                {item.title}
              </label>
            </li>
          ))}
      </ul>
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm" disabled={selected.size === 0}>
        Ausgewählte Quests abschließen ({selected.size})
      </button>
    </form>
  );
}
