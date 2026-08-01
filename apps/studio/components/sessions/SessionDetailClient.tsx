"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ViewEditToggle, WikiContent } from "@uwe/shared-ui";
import {
  GAME_SESSION_STATUS_LABELS,
  GameSessionStatusBadge,
  PageTypeBadge,
} from "@uwe/shared-ui";
import { buildPageUrl as dbBuildPageUrl } from "@uwe/database/page-types";
import type { DmGameSessionView } from "@uwe/database/server";
import {
  linkPageToSessionAction,
  publishSessionRecapAction,
  unlinkPageFromSessionAction,
  updateGameSessionAction,
} from "@/app/session-actions";
import { preparePrintListFromSessionAction } from "@/app/print-list-actions";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  cn,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface LinkablePage {
  id: string;
  title: string;
  type: string;
  slug: string;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  session: DmGameSessionView;
  linkablePages: LinkablePage[];
  /**
   * Notizen und DM-Zusammenfassung als gerendertes HTML mit aufgelösten
   * `[[Wikilinks]]`. Serverseitig gebaut, weil dafür der Welt-Index nötig ist.
   */
  richText?: { notesHtml?: string; summaryDmHtml?: string };
  flash?: {
    saved?: string;
    published?: string;
    linked?: string;
    unlinked?: string;
  };
}

/** Native select styling — Kit-Select (Radix) needs onValueChange/hidden-input
 * wiring to work inside a FormData Server Action; these two selects stay
 * native (see TODO(design-kit) comments below), consistent with
 * app/worlds/[worldSlug]/sessions/new/page.tsx. */
const SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

export function SessionDetailClient({
  worldSlug,
  sessionId,
  session,
  linkablePages,
  richText,
  flash,
}: Props) {
  const router = useRouter();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const readView = (
    <Card className="flex flex-col gap-4 p-4">
      <p>
        <GameSessionStatusBadge status={session.status} />
        {session.date ? (
          <span className="ml-2 text-sm text-muted-foreground">
            {session.date.toLocaleDateString("de-DE")}
          </span>
        ) : null}
      </p>
      {session.summaryPlayer ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">Spieler-Recap</h2>
          <p className="whitespace-pre-wrap">{session.summaryPlayer}</p>
        </section>
      ) : null}
      {session.summaryDm ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">DM-Zusammenfassung</h2>
          {richText?.summaryDmHtml ? (
            <WikiContent html={richText.summaryDmHtml} readMode={false} />
          ) : (
            <p className="whitespace-pre-wrap">{session.summaryDm}</p>
          )}
        </section>
      ) : null}
      {session.notes ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">Vorbereitungsnotizen</h2>
          {richText?.notesHtml ? (
            <WikiContent html={richText.notesHtml} readMode={false} />
          ) : (
            <p className="whitespace-pre-wrap">{session.notes}</p>
          )}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/worlds/${worldSlug}/prepare-session?sessionId=${sessionId}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Session vorbereiten →
        </Link>
        <Link
          href={`/worlds/${worldSlug}/sessions/${sessionId}/live`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Live-Modus
        </Link>
      </div>
    </Card>
  );

  const editView = (
    <>
      <form
        action={async (formData) => {
          await updateGameSessionAction(formData);
          setSavedHint("Gespeichert.");
          router.refresh();
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-detail-title">Titel</Label>
          <Input id="session-detail-title" name="title" defaultValue={session.title} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-detail-number">Session-Nummer</Label>
          <Input
            id="session-detail-number"
            name="sessionNumber"
            type="number"
            min={1}
            defaultValue={session.sessionNumber}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-detail-date">Datum</Label>
          <Input
            id="session-detail-date"
            type="date"
            name="date"
            defaultValue={session.date ? session.date.toISOString().slice(0, 10) : ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-detail-status">Status</Label>
          {/* TODO(design-kit): natives Select statt Kit-Select — Server-Action-Formular
              (FormData) braucht name/defaultValue ohne Client-State. */}
          <select
            id="session-detail-status"
            name="status"
            defaultValue={session.status}
            className={cn(SELECT_CLASS, "w-full")}
          >
            {(Object.keys(GAME_SESSION_STATUS_LABELS) as Array<keyof typeof GAME_SESSION_STATUS_LABELS>).map(
              (status) => (
              <option key={status} value={status}>
                {GAME_SESSION_STATUS_LABELS[status]}
              </option>
            ),
            )}
          </select>
        </div>
        <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">DM-Notizen (nur Studio)</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-detail-summary-dm">DM-Zusammenfassung</Label>
            <Textarea
              id="session-detail-summary-dm"
              name="summaryDm"
              rows={5}
              defaultValue={session.summaryDm ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-detail-notes">Vorbereitungsnotizen</Label>
            <Textarea id="session-detail-notes" name="notes" rows={4} defaultValue={session.notes ?? ""} />
          </div>
        </fieldset>
        {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
        <label className={cn(CHECKBOX_ROW_CLASS, "mt-4")}>
          <input
            type="checkbox"
            name="playerVisibleSchedule"
            defaultChecked={session.playerVisibleSchedule}
            className={CHECKBOX_CLASS}
          />
          Termin für Spieler im Portal ankündigen
        </label>
        <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">Spieler-Recap</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-detail-summary-player">Recap für Spieler</Label>
            <Textarea
              id="session-detail-summary-player"
              name="summaryPlayer"
              rows={5}
              defaultValue={session.summaryPlayer ?? ""}
            />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">Nachbereitung</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-detail-open-plots">Offene Plots</Label>
            <Textarea
              id="session-detail-open-plots"
              name="openPlots"
              rows={4}
              defaultValue={session.openPlots ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-detail-player-decisions">Spielerentscheidungen</Label>
            <Textarea
              id="session-detail-player-decisions"
              name="playerDecisions"
              rows={4}
              defaultValue={session.playerDecisions ?? ""}
            />
          </div>
        </fieldset>
        <Button type="submit">Speichern</Button>
        {savedHint ? <p className="text-sm text-muted-foreground">{savedHint}</p> : null}
      </form>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-base text-muted-foreground">Verknüpfte Seiten</h2>
        {session.linkedPages.length > 0 ? (
          <ul className="flex flex-col gap-3 text-sm">
            {session.linkedPages.map((page) => (
              <li
                key={page.id}
                className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
              >
                <Link href={dbBuildPageUrl(worldSlug, page.type, page.slug)}>{page.title}</Link>
                <PageTypeBadge type={page.type} />
                <form action={unlinkPageFromSessionAction} className="inline">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Entfernen
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">Noch keine verknüpften Seiten.</p>
        )}
        {linkablePages.length > 0 && (
          <form action={linkPageToSessionAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="sessionId" value={sessionId} />
            {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                "Seite verknüpfen…" — natives Select beibehalten. */}
            <select name="pageId" required className={SELECT_CLASS}>
              <option value="">Seite verknüpfen…</option>
              {linkablePages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} ({page.type})
                </option>
              ))}
            </select>
            <Button type="submit" variant="ghost">
              Verknüpfen
            </Button>
          </form>
        )}
      </section>
    </>
  );

  return (
    <>
      {flash?.saved && <Alert tone="success">Session gespeichert.</Alert>}
      {flash?.published && <Alert tone="success">Recap fürs Portal veröffentlicht.</Alert>}
      {flash?.linked && <Alert tone="success">Seite verknüpft.</Alert>}
      {flash?.unlinked && <Alert tone="success">Verknüpfung entfernt.</Alert>}

      {!session.recapPublished ? (
        <form action={publishSessionRecapAction} className="mb-4">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit" size="sm">
            Fürs Portal veröffentlichen
          </Button>
        </form>
      ) : null}

      <ViewEditToggle view={readView} edit={editView} />

      {session.linkedPages.length > 0 ? (
        <form
          action={preparePrintListFromSessionAction}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="name" value={`${session.title} — Handouts`} />
          {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
          <label className={CHECKBOX_ROW_CLASS}>
            <input type="checkbox" name="forNextSession" defaultChecked className={CHECKBOX_CLASS} />
            Für nächste Session markieren
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Druckliste vorbereiten
          </Button>
        </form>
      ) : null}
    </>
  );
}
