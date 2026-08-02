import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameSessionStatusBadge } from "@uwe/shared-ui";
import {
  buildPageUrl,
  buildRecapDraft,
  buildSessionReviewDraft,
  createAuthService,
  createPrismaClient,
  createSessionLiveService,
  getAppRepository,
  sessionLiveKindLabel,
  type SessionLiveEntryRecord,
} from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { isLikelyGameSessionId } from "@/src/lib/session-route";
import {
  applyQuestStatusFromReviewAction,
  saveSessionRecapDraftAction,
} from "@/app/session-live-actions";
import { getInferenceStatus } from "@uwe/ai-brain";
import { SessionRecapAiButton } from "@/components/SessionRecapAiButton";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
  searchParams: Promise<{ saved?: string; applied?: string }>;
}

const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function QuestStatusButtons({
  worldSlug,
  sessionId,
  pageId,
}: {
  worldSlug: string;
  sessionId: string;
  pageId: string;
}) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <form action={applyQuestStatusFromReviewAction}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="status" value="completed" />
        <Button type="submit" variant="outline" size="sm">
          Als erledigt markieren
        </Button>
      </form>
      <form action={applyQuestStatusFromReviewAction}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="status" value="failed" />
        <Button type="submit" variant="outline" size="sm">
          Als gescheitert markieren
        </Button>
      </form>
    </span>
  );
}

function ActionableList({
  title,
  entries,
  hrefFor,
  hint,
  renderActions,
}: {
  title: string;
  entries: SessionLiveEntryRecord[];
  hrefFor: (entry: SessionLiveEntryRecord) => string | null;
  hint: string;
  renderActions?: (entry: SessionLiveEntryRecord) => ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({entries.length})
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {entries.map((entry) => {
            const href = hrefFor(entry);
            return (
              <li key={entry.id} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                <span className="text-muted-foreground">{TIME_FORMAT.format(entry.createdAt)}</span>{" "}
                {entry.content}
                {href ? (
                  <>
                    {" — "}
                    <Link href={href} className="underline-offset-4 hover:underline">
                      betroffene Seite öffnen →
                    </Link>
                  </>
                ) : null}
                {renderActions ? <div className="mt-2">{renderActions(entry)}</div> : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function SessionReviewPage({ params, searchParams }: Props) {
  const { worldSlug, sessionId } = await params;
  const { saved, applied } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();
  if (!isLikelyGameSessionId(sessionId)) notFound();

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const session = await auth.getGameSessionForDm(worldSlug, sessionId);
  const entries = session ? await createSessionLiveService(db).listEntries(sessionId) : [];
  await db.$disconnect();

  if (!session) notFound();

  const draft = buildSessionReviewDraft(entries);
  const pageById = new Map(session.linkedPages.map((page) => [page.id, page]));
  const hrefFor = (entry: SessionLiveEntryRecord): string | null => {
    if (!entry.refPageId) return null;
    const page = pageById.get(entry.refPageId);
    return page ? buildPageUrl(worldSlug, page.type, page.slug) : null;
  };
  const questPageIdFor = (entry: SessionLiveEntryRecord): string | null => {
    if (!entry.refPageId) return null;
    const page = pageById.get(entry.refPageId);
    return page && page.type === "quest" ? page.id : null;
  };

  const recapSuggestion = session.summaryDm?.trim() || buildRecapDraft(entries);
  const inference = await getInferenceStatus();

  return (
    <>
      <ShellBreadcrumb
        items={[
          ...worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Sessions",
            `/worlds/${worldSlug}/sessions`,
            session.title,
          ),
          { label: "Review" },
        ]}
      />
      <PageHeader
        title={`Review · Session ${session.sessionNumber}`}
        summary="Vorgemerkte Ereignisse aus dem Live-Modus. Prüfe und übernimm sie bewusst — nichts wird automatisch Kanon."
        meta={<GameSessionStatusBadge status={session.status} />}
        actions={
          <Link href={`/worlds/${worldSlug}/sessions/${sessionId}`} className={buttonVariants({ variant: "outline" })}>
            Zur Session
          </Link>
        }
      />

      {saved ? <Alert tone="success" icon="check">Recap-Entwurf gespeichert.</Alert> : null}

      {applied ? (
        <Alert tone="success" icon="check">Quest-Status auf der referenzierten Seite gesetzt.</Alert>
      ) : null}

      {draft.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Für diese Session wurden keine Live-Einträge vorgemerkt.
        </p>
      ) : null}

      <ActionableList
        title="Quest-Änderungen"
        entries={draft.questUpdates}
        hrefFor={hrefFor}
        hint="Setze den Quest-Status auf der jeweiligen Quest-Seite — direkt hier oder auf der Seite selbst."
        renderActions={(entry) => {
          const questPageId = questPageIdFor(entry);
          if (!questPageId) return null;
          return (
            <QuestStatusButtons
              worldSlug={worldSlug}
              sessionId={sessionId}
              pageId={questPageId}
            />
          );
        }}
      />
      <ActionableList
        title="Beute"
        entries={draft.loot}
        hrefFor={hrefFor}
        hint="Übertrage die Beute in den Gruppenschatz oder das Charakter-Inventar."
      />
      <ActionableList
        title="NPC-Änderungen"
        entries={draft.npcUpdates}
        hrefFor={hrefFor}
        hint="Aktualisiere die NPC-Seiten; kanonische Fakten laufen über den normalen Review."
      />

      {draft.bookmarks.length > 0 || draft.notes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Verlauf &amp; Lesezeichen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {[...draft.notes, ...draft.bookmarks].map((entry) => (
                <li key={entry.id} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                  <span className="text-muted-foreground">{TIME_FORMAT.format(entry.createdAt)}</span>{" "}
                  <Badge>{sessionLiveKindLabel(entry.kind)}</Badge> {entry.content}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recap-Entwurf (DM)</CardTitle>
          <CardDescription>
            Aus den Einträgen vorgeschlagen. Bearbeiten und als DM-Zusammenfassung der
            Session speichern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveSessionRecapDraftAction} className="flex flex-col gap-3">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <Textarea name="summaryDm" rows={12} defaultValue={recapSuggestion} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Recap-Entwurf speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SessionRecapAiButton
        worldSlug={worldSlug}
        sessionId={sessionId}
        rtxReady={inference.online}
        rtxEnabled={inference.enabled}
      />
    </>
  );
}
