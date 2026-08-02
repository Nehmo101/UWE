import { notFound } from "next/navigation";
import { AI_TASK_LABELS } from "@uwe/ai-brain";
import {
  AI_RUN_STATUS_LABELS,
  createAiRunServiceFromClient,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { AiRunActions } from "@/components/AiRunActions";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { formatStudioDate } from "@/src/lib/format";

interface Props {
  params: Promise<{ worldSlug: string; runId: string }>;
}

function formatJson(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AiRunDetailPage({ params }: Props) {
  const { worldSlug, runId } = await params;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const run = await createAiRunServiceFromClient(db).getById(runId);
  await db.$disconnect();

  if (!run || run.worldId !== world.id) notFound();

  const contextPrompt =
    run.contextData &&
    typeof run.contextData === "object" &&
    "promptContext" in (run.contextData as Record<string, unknown>)
      ? String((run.contextData as { promptContext?: string }).promptContext ?? "")
      : "";

  return (
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          "KI-Läufe",
          `/worlds/${worldSlug}/ai-runs`,
          run.id.slice(0, 8),
        )}
      />
      <PageHeader
        title={AI_TASK_LABELS[run.taskType as keyof typeof AI_TASK_LABELS] ?? run.taskType}
        summary={`${AI_RUN_STATUS_LABELS[run.status]} · ${formatStudioDate(run.createdAt, "medium")}`}
      />
      <dl className="grid grid-cols-[minmax(6rem,10rem)_1fr] gap-x-4 gap-y-1 text-sm [&>dt]:text-muted-foreground [&>dd]:m-0">
        <dt>Provider</dt>
        <dd>{run.provider}</dd>
        <dt>Modell</dt>
        <dd>{run.model}</dd>
        <dt>Status</dt>
        <dd>{AI_RUN_STATUS_LABELS[run.status]}</dd>
        <dt>Seite</dt>
        <dd>{run.pageTitle ?? "—"}</dd>
        <dt>Session</dt>
        <dd>
          {run.gameSessionTitle
            ? `#${run.gameSessionNumber} ${run.gameSessionTitle}`
            : "—"}
        </dd>
        <dt>Dauer</dt>
        <dd>{run.durationMs != null ? `${run.durationMs} ms` : "—"}</dd>
        <dt>Quelle</dt>
        <dd>{run.source ?? "—"}</dd>
      </dl>

      <AiRunActions
        runId={run.id}
        worldSlug={worldSlug}
        status={run.status}
        resultText={run.resultText}
      />

      {run.errorMessage && (
        <section className="ai-run-section">
          <h3>Fehler</h3>
          <pre className="ai-run-pre ai-run-error">{run.errorMessage}</pre>
          {run.errorDetails != null && (
            <pre className="ai-run-pre">{formatJson(run.errorDetails)}</pre>
          )}
        </section>
      )}

      {run.systemPrompt && (
        <section className="ai-run-section">
          <h3>System-Prompt</h3>
          <pre className="ai-run-pre">{run.systemPrompt}</pre>
        </section>
      )}

      {run.userPrompt && (
        <section className="ai-run-section">
          <h3>User-Prompt</h3>
          <pre className="ai-run-pre">{run.userPrompt}</pre>
        </section>
      )}

      {contextPrompt && (
        <section className="ai-run-section">
          <h3>Kontext (Prompt)</h3>
          <pre className="ai-run-pre">{contextPrompt}</pre>
        </section>
      )}

      {run.contextData != null && (
        <details className="ai-run-section">
          <summary>Kontext (JSON)</summary>
          <pre className="ai-run-pre">{formatJson(run.contextData)}</pre>
        </details>
      )}

      {run.resultText && (
        <section className="ai-run-section">
          <h3>Ergebnis</h3>
          <pre className="ai-run-pre">{run.resultText}</pre>
        </section>
      )}

      {run.resultMeta != null && (
        <details className="ai-run-section">
          <summary>Ergebnis-Metadaten</summary>
          <pre className="ai-run-pre">{formatJson(run.resultMeta)}</pre>
        </details>
      )}
    </>
  );
}
