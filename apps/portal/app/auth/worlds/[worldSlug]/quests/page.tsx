import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import {
  GlobalSearchForm,
  PageTypeBadge,
  QuestStatusBadge,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  isOpenQuest,
  QUEST_LIFECYCLE_LABELS,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import {
  createPlayerGroupService,
  createQuestFlagService,
  QUEST_PRIORITIES,
  QUEST_PRIORITY_LABELS,
  type QuestFlagView,
  type QuestPriority,
} from "@uwe/player-hub";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { setQuestPriorityAction } from "@/app/player-hub-actions";
import { PageHeader } from "@/src/components/shell";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string; priority?: string }>;
}

type StatusFilter = "all" | "open" | QuestLifecycleStatus;

const selectClassName =
  "ml-1 inline-flex h-8 rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (!raw || raw === "all") {
    return "all";
  }
  if (raw === "open" || raw === "completed" || raw === "failed") {
    return raw;
  }
  return "all";
}

function matchesStatusFilter(
  questStatus: QuestLifecycleStatus | null | undefined,
  filter: StatusFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "open") {
    return isOpenQuest(questStatus);
  }
  return questStatus === filter;
}

export default async function AuthWorldQuestsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, status: statusParam, priority: priorityParam } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const statusFilter = parseStatusFilter(statusParam);

  const viewerId = ctx.previewAsUserId ?? ctx.user?.id ?? null;
  const canFlag = Boolean(ctx.user) && !ctx.previewAsUserId;

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let quests: Awaited<ReturnType<typeof auth.listPagesForViewer>> = [];
  let flags: Map<string, QuestFlagView> = new Map();
  let groupName: string | null = null;
  let hasGroup = false;
  try {
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const allQuests = pages.filter((page) => page.type === "quest");

    /*
      Das Questlog zeigt nur, was der eigenen Tischrunde zugeordnet ist.
      `listPagesForViewer` kennt die Zuordnung nicht (sie ist juenger als die
      Auswahl dort), deshalb wird sie hier nachgeschlagen: erst die Gruppe des
      Viewers, dann die `questGroupId` der Quest-Seiten. Eine Quest ohne
      Gruppe ist DM-Material und erscheint bei niemandem — auch nicht bei der
      Runde, die sie „eigentlich" betrifft, solange der Spielleiter sie nicht
      im Kampagnen-Radar vergeben hat.
    */
    const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
    const group =
      world && viewerId
        ? await createPlayerGroupService(db).findForUser(world.id, viewerId)
        : null;
    groupName = group?.name ?? null;
    hasGroup = group !== null;

    if (group && allQuests.length > 0) {
      const assignments = await db.page.findMany({
        where: { id: { in: allQuests.map((page) => page.id) }, questGroupId: group.id },
        select: { id: true },
      });
      const assignedIds = new Set(assignments.map((row) => row.id));
      quests = allQuests.filter((page) => assignedIds.has(page.id));
    } else {
      quests = [];
    }

    if (viewerId && quests.length > 0) {
      flags = await createQuestFlagService(db).listForUser(
        viewerId,
        quests.map((page) => page.id),
      );
    }
  } finally {
    await db.$disconnect();
  }

  const priorityRank: Record<QuestPriority, number> = { high: 0, normal: 1, low: 2 };

  const priorityOnly = priorityParam === "high";

  const query = q?.trim().toLocaleLowerCase("de") ?? "";
  const filtered = quests
    .filter((page) => matchesStatusFilter(page.questStatus, statusFilter))
    .filter((page) => {
      if (!priorityOnly) return true;
      return flags.get(page.id)?.priority === "high";
    })
    .filter((page) => {
      if (!query) {
        return true;
      }
      const haystack = [page.title, page.slug, page.summary ?? ""]
        .join(" ")
        .toLocaleLowerCase("de");
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const aRank = priorityRank[flags.get(a.id)?.priority ?? "normal"];
      const bRank = priorityRank[flags.get(b.id)?.priority ?? "normal"];
      return aRank - bRank;
    });

  const basePath = `/auth/worlds/${worldSlug}/quests`;

  return (
    <>
      <PageHeader
        title="Questlog"
        summary={
          groupName
            ? `Die Quests eurer Runde „${groupName}" — filterbar nach Status.`
            : "Die Quests deiner Tischrunde."
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Status:{" "}
        {(
          [
            { value: "all", label: "Alle" },
            { value: "open", label: "Offen" },
            { value: "completed", label: QUEST_LIFECYCLE_LABELS.completed },
            { value: "failed", label: QUEST_LIFECYCLE_LABELS.failed },
            { value: "priority", label: "Meine Priorität", param: "priority=high" },
          ] as const
        ).map((tab, index) => {
          const params = new URLSearchParams();
          if ("param" in tab && tab.param) {
            params.set("priority", "high");
          } else if (tab.value !== "all") {
            params.set("status", tab.value);
          }
          if (query) {
            params.set("q", query);
          }
          const href = params.size > 0 ? `${basePath}?${params}` : basePath;
          const active =
            ("param" in tab && tab.param ? priorityOnly : statusFilter === tab.value);

          return (
            <span key={tab.value}>
              {index > 0 ? " · " : null}
              {active ? (
                <strong>{tab.label}</strong>
              ) : (
                <Link href={href} className="text-primary hover:underline">
                  {tab.label}
                </Link>
              )}
            </span>
          );
        })}
      </p>

      <GlobalSearchForm
        action={basePath}
        query={q ?? ""}
        placeholder="Quests durchsuchen…"
        extraFields={
          <>
            {statusFilter !== "all" ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            {priorityOnly ? <input type="hidden" name="priority" value="high" /> : null}
          </>
        }
      />

      <ul className="mt-4 grid gap-2">
        {filtered.map((page) => {
          const flag = flags.get(page.id);
          const priority = flag?.priority ?? "normal";
          return (
            <li
              key={page.id}
              className="rounded-[var(--radius)] border border-border p-4"
            >
              <Link
                href={`/auth/worlds/${worldSlug}/${page.slug}`}
                className="block transition-colors hover:text-primary"
              >
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {priority === "high" ? (
                    <Star className="size-4 fill-current text-warning" aria-label="Wichtig" />
                  ) : null}
                  {page.title}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <PageTypeBadge type={page.type} />
                  <QuestStatusBadge status={page.questStatus ?? null} />
                </div>
                {page.summary ? (
                  <p className="mt-2 text-sm text-muted-foreground">{page.summary}</p>
                ) : null}
              </Link>
              {canFlag ? (
                <form action={setQuestPriorityAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <Label className="text-muted-foreground">
                    Meine Priorität:{" "}
                    <select name="priority" defaultValue={priority} className={selectClassName}>
                      {QUEST_PRIORITIES.map((value) => (
                        <option key={value} value={value}>
                          {QUEST_PRIORITY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <Button type="submit" size="sm" variant="secondary">
                    Speichern
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <PortalEmptyState
          title={
            query
              ? "Keine passenden Quests gefunden"
              : hasGroup
                ? "Eurer Runde ist noch keine Quest zugeordnet"
                : "Du bist noch keiner Tischrunde zugeordnet"
          }
          description={
            query
              ? "Probiere einen anderen Suchbegriff."
              : hasGroup
                ? "Der Spielleiter vergibt Quests im Kampagnen-Radar an eure Runde."
                : "Sobald der Spielleiter dich einer Gruppe zuordnet, erscheinen hier eure Quests."
          }
          icon="scroll"
        />
      ) : null}
    </>
  );
}
