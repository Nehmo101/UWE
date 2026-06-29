"use client";

import * as React from "react";
import type { KnowHowDoc } from "@/src/lib/uwe-knowhow";
import { Input } from "../ui/input";
import { EmptyState } from "../ui/states";
import { cn } from "../ui/cn";

export interface KnowHowBrowserProps {
  docs: KnowHowDoc[];
}

const SOURCE_LABEL: Record<KnowHowDoc["source"], string> = {
  README: "README",
  CHANGELOG: "Changelog",
  docs: "docs/",
};

export function KnowHowBrowser({ docs }: KnowHowBrowserProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      `${doc.title} ${doc.path} ${doc.excerpt}`.toLowerCase().includes(q),
    );
  }, [docs, query]);

  if (docs.length === 0) {
    return (
      <EmptyState
        icon="book-open"
        title="Keine Dokumentation gefunden"
        description="Die Doku-Quellen sind in dieser Umgebung nicht verfügbar (z. B. Standalone-Build ohne Repo-Quelle)."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="UWE-Doku durchsuchen (Titel, Pfad, Text)…"
        className="max-w-md"
      />
      <p className="text-xs text-muted-foreground">
        {filtered.length} von {docs.length} Dokumenten
      </p>
      <ul className="flex flex-col gap-2">
        {filtered.map((doc) => (
          <li
            key={doc.path}
            className={cn("rounded-[var(--radius)] border border-border p-3")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{doc.title}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {SOURCE_LABEL[doc.source]}
              </span>
            </div>
            {doc.excerpt ? (
              <p className="mt-1 text-sm text-muted-foreground">{doc.excerpt}</p>
            ) : null}
            <code className="mt-1 block text-xs text-muted-foreground">{doc.path}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
