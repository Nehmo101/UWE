"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

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

      <table className="uwe-page-table">
        <thead>
          <tr>
            <th aria-label="Reihenfolge" />
            <th>#</th>
            <th>Label</th>
            <th>Kopien</th>
            <th />
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
              className={dragIndex === index ? "is-dragging" : undefined}
            >
              <td className="uwe-drag-handle" title="Ziehen zum Sortieren">
                ⋮⋮
              </td>
              <td>{index + 1}</td>
              <td>
                <Link href={item.labelHref}>{item.title}</Link>
                {item.containsDmOnly && (
                  <p className="uwe-table-sub uwe-text-warning">DM-only</p>
                )}
              </td>
              <td>
                <input
                  type="number"
                  className="uwe-input-narrow"
                  min={1}
                  max={99}
                  value={item.copies}
                  onChange={(event) =>
                    setCopies(item.labelId, Number(event.target.value) || 1)
                  }
                  aria-label={`Kopien für ${item.title}`}
                />
              </td>
              <td>
                <Link href={item.previewHref}>Vorschau</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="uwe-empty">Noch keine Labels in dieser Druckliste.</p>
      )}
    </>
  );
}
