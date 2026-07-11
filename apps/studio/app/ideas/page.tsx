import Link from "next/link";
import {
  createDevAgentJobService,
  createDevIdeaService,
  parseDevIdeaTranscript,
  parseIdeaAttachments,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import {
  IDEA_WORKSPACE_VIEW_LABELS,
  parseIdeaWorkspaceView,
  type IdeaWorkspaceView,
} from "@uwe/database/dev-idea-constants";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireOwner } from "@/src/lib/auth";
import {
  IdeaWorkspaceClient,
  type IdeaAgentJobDto,
  type IdeaDto,
} from "./IdeaWorkspaceClient";

interface IdeasPageProps {
  searchParams: Promise<{ idea?: string; view?: string; lifecycle?: string; module?: string }>;
}

function toAgentJobDto(job: {
  id: string; status: string; provider: string; branchName: string | null;
  prUrl: string | null; errorMessage: string | null; result: unknown;
}): IdeaAgentJobDto {
  const cursor = job.result && typeof job.result === "object"
    ? ((job.result as Record<string, unknown>).cursor as { summary?: string | null; url?: string | null } | undefined)
    : undefined;
  return {
    id: job.id, status: job.status, provider: job.provider, branchName: job.branchName,
    prUrl: job.prUrl, errorMessage: job.errorMessage,
    summary: cursor?.summary ?? null, url: cursor?.url ?? null,
  };
}

const VIEW_SUMMARIES: Record<IdeaWorkspaceView, string> = {
  all: "Ideen sammeln, im KI-Chat schärfen und als Prompt an Cursor übergeben — mit Typ, Lifecycle und Modul.",
  features: "Feature-Registry: vorhandene und geplante UWE-Funktionen mit Lifecycle-Status, Modul und Reifegrad.",
  prompts: "Prompt-Bibliothek: gespeicherte Cursor-/Orchestrator-Prompts aus dem Ideen-Workflow.",
};

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  await requireOwner();
  const { idea: selectedParam, view: viewParam, lifecycle, module } = await searchParams;
  const view = parseIdeaWorkspaceView(viewParam);
  const ideaService = createDevIdeaService(prisma);
  const ideaRows = await ideaService.listIdeas({ limit: 200 });
  const agentJobService = createDevAgentJobService(prisma);
  const linkedJobIds = Array.from(new Set(ideaRows.map((row) => row.devAgentJobId).filter(Boolean))) as string[];
  const linkedJobs = await Promise.all(linkedJobIds.map((id) => agentJobService.getJob(id)));
  const agentJobsById: Record<string, IdeaAgentJobDto> = {};
  for (const job of linkedJobs) {
    if (job) agentJobsById[job.id] = toAgentJobDto(job);
  }
  const ideas: IdeaDto[] = ideaRows.map((row) => ({
    id: row.id, title: row.title, body: row.body, status: row.status,
    ideaType: row.ideaType, lifecycle: row.lifecycle, module: row.module, maturityLevel: row.maturityLevel,
    transcript: parseDevIdeaTranscript(row.chatTranscript), generatedPrompt: row.generatedPrompt,
    attachments: parseIdeaAttachments(row.attachments),
    devAgentJobId: row.devAgentJobId, updatedAt: row.updatedAt.toISOString(),
  }));
  const config = resolveAgentJobsConfig();
  const pageTitle = view === "all" ? "Ideen-Management" : IDEA_WORKSPACE_VIEW_LABELS[view];
  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Ideen" }]} />}>
      <PageHeader title={pageTitle} summary={VIEW_SUMMARIES[view]} />
      <IdeaWorkspaceClient
        ideas={ideas}
        agentJobsById={agentJobsById}
        initialSelectedId={selectedParam ?? ideas[0]?.id ?? null}
        initialView={view}
        initialLifecycleFilter={lifecycle ?? null}
        initialModuleFilter={module ?? null}
        agentJobs={{
          enabled: config.enabled, cursorConfigured: config.cursorCloudConfigured,
          githubRepo: config.githubRepo, defaultBranch: config.defaultBranch, defaultProvider: config.defaultProvider,
        }}
      />
      <p className="text-sm text-muted-foreground"><Link href="/today">← Heute</Link></p>
    </StudioShell>
  );
}
