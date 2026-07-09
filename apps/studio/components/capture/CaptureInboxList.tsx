"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CAPTURE_STATUS_LABELS, CAPTURE_TYPE_LABELS, type CaptureStatus, type CaptureType } from "@uwe/database/capture-constants";
import { bulkArchiveCapturesAction, deleteCaptureAction } from "@/app/capture-actions";
import { formatStudioDateTime } from "@/src/lib/format";

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
      <div className="uwe-capture-source-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            data-active={(!sourceFilter && !tab.id) || sourceFilter === tab.id ? "true" : "false"}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {captures.length > 0 ? (
        <div className="uwe-capture-bulk-bar">
          <label className="uwe-checkbox-row">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(captures.map((capture) => capture.id)))
              }
            />
            Alle auswählen
          </label>
          {selected.size > 0 ? (
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
              disabled={busy}
              onClick={() => void bulkArchive()}
            >
              {selected.size} archivieren
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="uwe-today-card-list">
        {captures.map((capture) => {
          const intent = readIntent(capture.metadata);
          const typeLabel =
            intent === "life_brain" ? "Life-Brain-Fakt" : CAPTURE_TYPE_LABELS[capture.captureType];

          return (
            <article
              key={capture.id}
              className="uwe-today-card uwe-v2-card uwe-v2-card-padded uwe-capture-inbox-card"
            >
              <label className="uwe-capture-select">
                <input
                  type="checkbox"
                  checked={selected.has(capture.id)}
                  onChange={() => toggleOne(capture.id)}
                  aria-label={`${capture.title} auswählen`}
                />
              </label>
              <Link href={`/capture/${capture.id}`} className="uwe-capture-inbox-link">
                <h3>{capture.title}</h3>
                <p>
                  {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
                  {formatStudioDateTime(new Date(capture.capturedAt))}
                </p>
                {capture.content ? <p className="uwe-capture-snippet">{capture.content}</p> : null}
                {capture.storageKey ? <p className="uwe-capture-snippet">📎 Anhang</p> : null}
              </Link>
              <div className="uwe-inline-actions">
                <Link href={`/capture/${capture.id}`} className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                  Triage
                </Link>
                <form action={deleteCaptureAction}>
                  <input type="hidden" name="id" value={capture.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
