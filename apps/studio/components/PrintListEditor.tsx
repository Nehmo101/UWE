"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { cn, Input } from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

export interface PrintListEditorItem {
  labelId: string;
  title: string;
  copies: number;
  containsDmOnly?: boolean;
  previewHref: string;
  labelHref: string;
}

interface Props {
  items: PrintListEditorItem[];
  labelOrderFieldName?: string;
  copiesJsonFieldName?: string;
}

export function PrintListEditor({
  items: initialItems,
  labelOrderFieldName = "labelOrder",
  copiesJsonFieldName = "copiesJson",
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const labelOrder = items.map((item) => item.labelId).join(",");
  const copiesJson = JSON.stringify(
    Object.fromEntries(items.map((item) => [item.labelId, item.copies])),
  );

  const moveItem = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const setCopies = useCallback((labelId: string, copies: number) => {
    const safe = Math.max(1, Math.min(99, copies));
    setItems((current) =>
      current.map((item) =>
        item.labelId === labelId ? { ...item, copies: safe } : item,
      ),
    );
  }, []);

  return (
    <>
      <input type="hidden" name={labelOrderFieldName} value={labelOrder} readOnly />
      <input type="hidden" name={copiesJsonFieldName} value={copiesJson} readOnly />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH_CLASS} aria-label="Reihenfolge" />
              <th className={TH_CLASS}>#</th>
              <th className={TH_CLASS}>Label</th>
              <th className={TH_CLASS}>Kopien</th>
              <th className={TH_CLASS} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.labelId}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) {
                    moveItem(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(dragIndex === index && "opacity-50")}
              >
                <td className={cn(TD_CLASS, "cursor-grab text-muted-foreground")} title="Ziehen zum Sortieren">
                  ⋮⋮
                </td>
                <td className={TD_CLASS}>{index + 1}</td>
                <td className={TD_CLASS}>
                  <Link href={item.labelHref}>{item.title}</Link>
                  {item.containsDmOnly && (
                    <p className="text-sm text-warning">DM-only</p>
                  )}
                </td>
                <td className={TD_CLASS}>
                  <Input
                    type="number"
                    className="w-20"
                    min={1}
                    max={99}
                    value={item.copies}
                    onChange={(event) =>
                      setCopies(item.labelId, Number(event.target.value) || 1)
                    }
                    aria-label={`Kopien für ${item.title}`}
                  />
                </td>
                <td className={TD_CLASS}>
                  <Link href={item.previewHref}>Vorschau</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Labels in dieser Druckliste.</p>
      )}
    </>
  );
}
