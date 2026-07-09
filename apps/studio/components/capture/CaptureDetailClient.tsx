"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ViewEditToggle } from "@uwe/shared-ui";
import { CaptureTriagePanel } from "@/components/capture/CaptureTriagePanel";
import { CAPTURE_STATUS_LABELS, CAPTURE_TYPE_LABELS } from "@uwe/database/capture-constants";
import type { CaptureEntry, HardwareDevice } from "@uwe/database/server";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface WorldOption {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  capture: CaptureEntry;
  worlds: WorldOption[];
  hardwareDevices: HardwareDevice[];
}

export function CaptureDetailClient({ capture, worlds, hardwareDevices }: Props) {
  const typeLabel = CAPTURE_TYPE_LABELS[capture.captureType];

  const readView = useMemo(
    () => (
      <article className="uwe-v2-card uwe-v2-card-padded">
        <p className="uwe-dashboard-muted">
          {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
          {DATE_FORMAT.format(capture.capturedAt)}
        </p>
        <h2 className="uwe-v2-section-title">{capture.title}</h2>
        {capture.content ? <p style={{ whiteSpace: "pre-wrap" }}>{capture.content}</p> : null}
        {capture.url ? (
          <p>
            <a href={capture.url} target="_blank" rel="noreferrer">
              {capture.url}
            </a>
          </p>
        ) : null}
        {capture.storageKey ? (
          <p>
            <a href={`/api/capture/files/${capture.id}`} target="_blank" rel="noreferrer">
              Anhang öffnen
            </a>
          </p>
        ) : null}
      </article>
    ),
    [capture, typeLabel],
  );

  return (
    <>
      <ViewEditToggle
        view={readView}
        edit={<CaptureTriagePanel capture={capture} worlds={worlds} hardwareDevices={hardwareDevices} />}
      />
      <p className="uwe-dashboard-muted">
        <Link href="/capture">← Zurück zur Inbox</Link>
      </p>
    </>
  );
}
