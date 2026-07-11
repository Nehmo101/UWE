"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomThemeAction } from "../app/custom-theme-actions";
import { Alert, Badge, Button } from "@/src/components/ui";

export interface CustomThemeSummary {
  id: string;
  label: string;
  description?: string;
  scope: "studio" | "portal" | "both";
  colors: Record<string, string>;
}

const SCOPE_LABEL: Record<CustomThemeSummary["scope"], string> = {
  studio: "Studio",
  portal: "Portal",
  both: "Studio & Portal",
};

const SWATCH_KEYS = ["bg", "panel", "fg", "accent"];

export function CustomThemesManager({ themes }: { themes: CustomThemeSummary[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (themes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine eigenen Designs. Erstelle oben eins mit dem Design-Assistenten.
      </p>
    );
  }

  const remove = (id: string) => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteCustomThemeAction(id);
        router.refresh();
      } catch {
        setError("Löschen fehlgeschlagen.");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <Alert tone="danger" role="status">
          {error}
        </Alert>
      )}
      <ul className="flex flex-col gap-2">
        {themes.map((theme) => (
          <li
            key={theme.id}
            className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3 text-card-foreground shadow-sm"
          >
            <span
              className="grid h-9 w-[72px] flex-none grid-cols-4 overflow-hidden rounded-[var(--radius)] border border-border"
              aria-hidden="true"
            >
              {SWATCH_KEYS.map((k) => (
                <span key={k} style={{ background: theme.colors[k] ?? "#000" }} />
              ))}
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <strong className="font-semibold">{theme.label}</strong>
              <Badge>{SCOPE_LABEL[theme.scope]}</Badge>
              {theme.description && (
                <span className="w-full text-xs text-muted-foreground">{theme.description}</span>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(theme.id)}
              disabled={pendingId === theme.id}
            >
              {pendingId === theme.id ? "Lösche…" : "Löschen"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
