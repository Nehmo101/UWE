"use client";

import { ResponsiveTable } from "@uwe/shared-ui";
import Link from "next/link";
import { useCallback, useState } from "react";
import { cn, Input } from "@/src/components/ui";


export interface PrintListEditorItem {
  labelId: string;
  title: string;
  copies: number;
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

      <ResponsiveTable
        caption="Etiketten dieser Druckliste"
        rowKey={(item) => item.labelId}
        rows={items}
        // Ziehen zum Sortieren bleibt an der Zeile — es ist Verhalten, kein
        // Inhalt, und hat deshalb keine eigene Spalte.
        rowProps={(_item, index) => ({
          draggable: true,
          onDragStart: () => setDragIndex(index),
          onDragOver: (event) => event.preventDefault(),
          onDrop: () => {
            if (dragIndex !== null) {
              moveItem(dragIndex, index);
            }
            setDragIndex(null);
          },
          onDragEnd: () => setDragIndex(null),
          className: cn(dragIndex === index && "opacity-50"),
        })}
        columns={[
          {
            key: "label",
            label: "Label",
            primary: true,
            render: (item) => <Link href={item.labelHref}>{item.title}</Link>,
          },
          {
            key: "drag",
            label: "Reihenfolge",
            render: () => (
              <span className="cursor-grab text-muted-foreground" title="Ziehen zum Sortieren">
                ⋮⋮
              </span>
            ),
          },
          {
            key: "position",
            label: "#",
            numeric: true,
            render: (item) => items.indexOf(item) + 1,
          },
          {
            key: "copies",
            label: "Kopien",
            render: (item) => (
              <Input
                type="number"
                className="w-20"
                min={1}
                max={99}
                value={item.copies}
                onChange={(event) => setCopies(item.labelId, Number(event.target.value) || 1)}
                aria-label={`Kopien für ${item.title}`}
              />
            ),
          },
          {
            key: "preview",
            label: "Vorschau",
            render: (item) => <Link href={item.previewHref}>Vorschau</Link>,
          },
        ]}
      />
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Labels in dieser Druckliste.</p>
      )}
    </>
  );
}
