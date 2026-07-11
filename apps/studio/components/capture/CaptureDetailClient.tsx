"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ViewEditToggle } from "@uwe/shared-ui";
import { CaptureTriagePanel } from "@/components/capture/CaptureTriagePanel";
import { CAPTURE_STATUS_LABELS, CAPTURE_TYPE_LABELS } from "@uwe/database/capture-constants";
import type { CaptureEntry, HardwareDevice } from "@uwe/database/capture-triage-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui";

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
      <Card>
        <CardHeader>
          <CardDescription>
            {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
            {DATE_FORMAT.format(capture.capturedAt)}
          </CardDescription>
          <CardTitle>{capture.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {capture.content ? <p className="whitespace-pre-wrap">{capture.content}</p> : null}
          {capture.url ? (
            <p>
              <a
                href={capture.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {capture.url}
              </a>
            </p>
          ) : null}
          {capture.storageKey ? (
            <p>
              <a
                href={`/api/capture/files/${capture.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Anhang öffnen
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    ),
    [capture, typeLabel],
  );

  return (
    <>
      <ViewEditToggle
        view={readView}
        edit={<CaptureTriagePanel capture={capture} worlds={worlds} hardwareDevices={hardwareDevices} />}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/capture">← Zurück zur Inbox</Link>
      </p>
    </>
  );
}
