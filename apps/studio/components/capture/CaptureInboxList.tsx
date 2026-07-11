"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CAPTURE_STATUS_LABELS, CAPTURE_TYPE_LABELS, type CaptureStatus, type CaptureType } from "@uwe/database/capture-constants";
import { bulkArchiveCapturesAction, deleteCaptureAction } from "@/app/capture-actions";
import { formatStudioDateTime } from "@/src/lib/format";
import { Button, buttonVariants, Card } from "@/src/components/ui";

export interface CaptureInboxItem {
  id: string;
  title: string;
  content: string | null;
  captureType: CaptureType;
  status: CaptureStatus;
  capturedAt: string;
  storageKey: string | null;
  metadata: unknown;
}

interface CaptureInboxListProps {
  captures: CaptureInboxItem[];
  statusFilter?: string;
  sourceFilter?: "manual" | "mail" | "scan";
}

/** Native checkbox — kein Checkbox-Kit-Component vorhanden. TODO(design-kit): natives
 * input[type=checkbox] + Tailwind verwendet, siehe Verwendungen unten. */
const CHECKBOX_CLASS = "size-4 rounded border-input";

function readIntent(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const intent = (metadata as Record<string, unknown>).captureIntent;
  return typeof intent === "string" ? intent : null;
}

function sourceTabs(status: string | undefined) {
  const base = status ? `?status=${status}` : "";
  const join = base ? "&" : "?";
  return [
    { id: undefined, label: "Alle Quellen", href: `/capture${base}` },
    { id: "manual", label: "Manuell", href: `/capture${base}${join}source=manual` },
    { id: "mail", label: "Mail", href: `/capture${base}${join}source=mail` },
    { id: "scan", label: "Scan/Upload", href: `/capture${base}${join}source=scan` },
  ] as const;
}

export function CaptureInboxList({ captures, statusFilter, sourceFilter }: CaptureInboxListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const allSelected = captures.length > 0 && selected.size === captures.length;
  const tabs = useMemo(() => sourceTabs(statusFilter), [statusFilter]);

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkArchive() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("ids", [...selected].join(","));
      await bulkArchiveCapturesAction(formData);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            data-active={(!sourceFilter && !tab.id) || sourceFilter === tab.id ? "true" : "false"}
            className="text-sm text-muted-foreground data-[active=true]:font-semibold data-[active=true]:text-foreground data-[active=true]:underline"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {captures.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(captures.map((capture) => capture.id)))
              }
              className={CHECKBOX_CLASS}
            />
            Alle auswählen
          </label>
          {selected.size > 0 ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void bulkArchive()}>
              {selected.size} archivieren
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {captures.map((capture) => {
          const intent = readIntent(capture.metadata);
          const typeLabel =
            intent === "life_brain" ? "Life-Brain-Fakt" : CAPTURE_TYPE_LABELS[capture.captureType];

          return (
            <Card key={capture.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selected.has(capture.id)}
                  onChange={() => toggleOne(capture.id)}
                  aria-label={`${capture.title} auswählen`}
                  className={CHECKBOX_CLASS}
                />
              </label>
              <Link href={`/capture/${capture.id}`} className="flex flex-col gap-1 text-inherit no-underline">
                <h3 className="text-sm font-semibold">{capture.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
                  {formatStudioDateTime(new Date(capture.capturedAt))}
                </p>
                {capture.content ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{capture.content}</p>
                ) : null}
                {capture.storageKey ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">📎 Anhang</p>
                ) : null}
              </Link>
              <div className="flex flex-wrap gap-2">
                <Link href={`/capture/${capture.id}`} className={buttonVariants({ size: "sm" })}>
                  Triage
                </Link>
                <form action={deleteCaptureAction}>
                  <input type="hidden" name="id" value={capture.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Löschen
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
