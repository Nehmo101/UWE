"use client";

import { useState } from "react";
import { Button, Checkbox } from "@/src/components/ui";

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
    <form
      action={action}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <h2 className="text-base font-semibold tracking-tight">Bulk schließen</h2>
      <p className="text-sm text-muted-foreground">
        Offene Quests als erledigt markieren (nur Quest-Kategorie).
      </p>
      <ul className="flex flex-col gap-2">
        {items
          .filter((item) => item.category === "open_quest")
          .map((item) => (
            <li key={item.id}>
              <Checkbox
                name="itemIds"
                value={item.id}
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                label={item.title}
              />
            </li>
          ))}
      </ul>
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={selected.size === 0}
        className="self-start"
      >
        Ausgewählte Quests abschließen ({selected.size})
      </Button>
    </form>
  );
}
