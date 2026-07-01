import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge, VisibilityBadge } from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  isOpenQuest,
  QUEST_LIFECYCLE_LABELS,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}

type StatusFilter = "all" | "open" | QuestLifecycleStatus;

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

function statusLabel(questStatus: QuestLifecycleStatus | null | undefined): string {
  if (isOpenQuest(questStatus)) {
    return "Offen";
  }
  if (questStatus) {
    return QUEST_LIFECYCLE_LABELS[questStatus];
  }
  return "Offen";
}

export default async function AuthWorldQuestsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, status: statusParam } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const statusFilter = parseStatusFilter(statusParam);

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let quests;
  try {
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    quests = pages.filter((page) => page.type === "quest");
  } finally {
    await db.$disconnect();
  }

  const query = q?.trim().toLocaleLowerCase("de") ?? "";
  const filtered = quests
    .filter((page) => matchesStatusFilter(page.questStatus, statusFilter))
    .filter((page) => {
      if (!query) {
        return true;
      }
      const haystack = [page.title, page.slug, page.summary ?? ""]
        .join(" ")
        .toLocaleLowerCase("de");
      return haystack.includes(query);
    });

  const basePath = `/auth/worlds/${worldSlug}/quests`;

  return (
    <section className="portal-content-card">
      <h1>Questlog</h1>
      <p className="auth-lead">
        Quests, die für deine Rolle ({ctx.effectiveRole}) freigeschaltet sind — filterbar nach
        Status.
      </p>

      <p className="auth-muted">
        Status:{" "}
        {(
          [
            { value: "all", label: "Alle" },
            { value: "open", label: "Offen" },
            { value: "completed", label: QUEST_LIFECYCLE_LABELS.completed },
            { value: "failed", label: QUEST_LIFECYCLE_LABELS.failed },
          ] as const
        ).map((tab, index) => {
          const params = new URLSearchParams();
          if (tab.value !== "all") {
            params.set("status", tab.value);
          }
          if (query) {
            params.set("q", query);
          }
          const href = params.size > 0 ? `${basePath}?${params}` : basePath;
          const active = statusFilter === tab.value;

          return (
            <span key={tab.value}>
              {index > 0 ? " · " : null}
              {active ? (
                <strong>{tab.label}</strong>
              ) : (
                <Link href={href}>{tab.label}</Link>
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
          statusFilter !== "all" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : undefined
        }
      />

      <ul className="auth-page-list">
        {filtered.map((page) => (
          <li key={page.id}>
            <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
              <strong>{page.title}</strong>
              <span className="auth-page-list-badges">
                <PageTypeBadge type={page.type} />
                <VisibilityBadge visibility={page.visibility} />
                <span className="auth-muted">{statusLabel(page.questStatus)}</span>
              </span>
              {page.summary && <p className="portal-dash-summary">{page.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p>
          {query
            ? "Keine passenden Quests gefunden."
            : "Noch keine Quests für deine Rolle freigeschaltet."}
        </p>
      )}
    </section>
  );
}
