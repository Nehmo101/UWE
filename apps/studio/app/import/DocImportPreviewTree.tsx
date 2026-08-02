"use client";

import { useCallback, useMemo } from "react";
import type { DocImportItem, DocImportPreview } from "@uwe/doc-import";
import type { PageType } from "@uwe/database/enums";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  preview: DocImportPreview;
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  /** Von Hand korrigierte Seitentypen, nach Entwurfs-Schlüssel. */
  typeOverrides: Record<string, PageType>;
  onTypeChange: (key: string, type: PageType | null) => void;
  disabled?: boolean;
}

/**
 * Die Typen zur Auswahl, in der Reihenfolge, in der man sie sucht.
 *
 * Die Zuordnung des Imports ist eine Vorbelegung, keine Wahrheit. Ohne diese
 * Auswahl hieße eine danebenliegende Rolle: nach dem Import 63 Seiten einzeln
 * nachbessern — also genau die Arbeit, die der Import abnehmen soll.
 */
const TYPE_OPTIONS = (Object.keys(PAGE_TYPE_LABELS) as PageType[]).sort((a, b) =>
  PAGE_TYPE_LABELS[a].localeCompare(PAGE_TYPE_LABELS[b], "de"),
);

const STATUS_LABEL: Record<DocImportItem["status"], string> = {
  new: "neu",
  conflict: "Slug vergeben",
  duplicate: "Titel vorhanden",
};

const STATUS_VARIANT: Record<DocImportItem["status"], "default" | "warning" | "info"> = {
  new: "default",
  conflict: "warning",
  duplicate: "info",
};

/** Kinder folgen ihren Eltern — beim Abwählen muss der Teilbaum mit. */
function collectSubtree(items: DocImportItem[], rootKey: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentKey) continue;
    const siblings = childrenByParent.get(item.parentKey) ?? [];
    siblings.push(item.key);
    childrenByParent.set(item.parentKey, siblings);
  }

  const collected: string[] = [];
  const walk = (key: string) => {
    collected.push(key);
    for (const child of childrenByParent.get(key) ?? []) walk(child);
  };
  walk(rootKey);

  return collected;
}

export function DocImportPreviewTree({
  preview,
  selectedKeys,
  onSelectionChange,
  typeOverrides,
  onTypeChange,
  disabled,
}: Props) {
  const toggle = useCallback(
    (item: DocImportItem) => {
      const next = new Set(selectedKeys);
      const subtree = collectSubtree(preview.items, item.key);

      if (next.has(item.key)) {
        for (const key of subtree) next.delete(key);
      } else {
        for (const key of subtree) next.add(key);
        // Eltern mitnehmen, sonst hinge die Seite in der Luft.
        let parentKey = item.parentKey;
        const byKey = new Map(preview.items.map((entry) => [entry.key, entry]));
        while (parentKey) {
          next.add(parentKey);
          parentKey = byKey.get(parentKey)?.parentKey ?? null;
        }
      }

      onSelectionChange(next);
    },
    [onSelectionChange, preview.items, selectedKeys],
  );

  const setAll = useCallback(
    (selected: boolean) => {
      onSelectionChange(selected ? new Set(preview.items.map((item) => item.key)) : new Set());
    },
    [onSelectionChange, preview.items],
  );

  const retyped = Object.keys(typeOverrides).length;

  const counts = useMemo(
    () =>
      [
        preview.summary.new > 0 ? `${preview.summary.new} neu` : null,
        preview.summary.conflict > 0 ? `${preview.summary.conflict} mit vergebenem Slug` : null,
        preview.summary.duplicate > 0 ? `${preview.summary.duplicate} mit vorhandenem Titel` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [preview.summary],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vorschau — {preview.items.length} Seite(n)</CardTitle>
        <p className="text-sm text-muted-foreground">
          {counts}
          {retyped > 0 ? ` · ${retyped} Typ(en) von Hand geändert` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview.warnings.map((warning) => (
          <Alert key={warning} tone="warning">
            {warning}
          </Alert>
        ))}

        {preview.unresolvedLinks.length > 0 ? (
          <Alert tone="info">
            {preview.unresolvedLinks.length} Wikilink-Ziel(e) gibt es noch nicht — die Links bleiben
            als offene Verweise stehen und heilen, sobald die Seiten entstehen:{" "}
            {preview.unresolvedLinks.slice(0, 10).join(", ")}
            {preview.unresolvedLinks.length > 10 ? " …" : ""}
          </Alert>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setAll(true)} disabled={disabled}>
            Alle
          </Button>
          <Button type="button" variant="outline" onClick={() => setAll(false)} disabled={disabled}>
            Keine
          </Button>
        </div>

        <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
          {preview.items.map((item) => (
            <li
              key={item.key}
              className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50"
              style={{ paddingInlineStart: `${item.depth * 1.25 + 0.25}rem` }}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedKeys.has(item.key)}
                onChange={() => toggle(item)}
                disabled={disabled}
                aria-label={`${item.title} auswählen`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{item.title}</span>
                  <select
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                    value={typeOverrides[item.key] ?? item.type}
                    disabled={disabled}
                    aria-label={`Typ von ${item.title}`}
                    onChange={(event) => {
                      const next = event.target.value as PageType;
                      onTypeChange(item.key, next === item.type ? null : next);
                    }}
                  >
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {PAGE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  {typeOverrides[item.key] ? <Badge variant="info">geändert</Badge> : null}
                  {item.canonicalStatus ? <Badge>{item.canonicalStatus}</Badge> : null}
                  {item.status !== "new" ? (
                    <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">/{item.slug}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
