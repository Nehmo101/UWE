import Link from "next/link";
import {
  createDevAgentJobService,
  createDevIdeaService,
  parseDevIdeaTranscript,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireOwner } from "@/src/lib/auth";
import {
  IdeaWorkspaceClient,
  type IdeaAgentJobDto,
  type IdeaDto,
} from "./IdeaWorkspaceClient";

interface IdeasPageProps {
  searchParams: Promise<{ idea?: string }>;
}

function toAgentJobDto(job: {
  id: string;
  status: string;
  provider: string;
  branchName: string | null;
  prUrl: string | null;
  errorMessage: string | null;
  result: unknown;
}): IdeaAgentJobDto {
  const cursor =
    job.result && typeof job.result === "object"
      ? ((job.result as Record<string, unknown>).cursor as
          | { summary?: string | null; url?: string | null }
          | undefined)
      : undefined;
  return {
    id: job.id,
    status: job.status,
    provider: job.provider,
    branchName: job.branchName,
    prUrl: job.prUrl,
    errorMessage: job.errorMessage,
    summary: cursor?.summary ?? null,
    url: cursor?.url ?? null,
  };
}

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  await requireOwner();
  const { idea: selectedParam } = await searchParams;

  const ideaService = createDevIdeaService(prisma);
  const ideaRows = await ideaService.listIdeas({ limit: 200 });

  const agentJobService = createDevAgentJobService(prisma);
  const linkedJobIds = Array.from(
    new Set(
      ideaRows
        .map((row) => row.devAgentJobId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const linkedJobs = await Promise.all(linkedJobIds.map((id) => agentJobService.getJob(id)));
  const agentJobsById: Record<string, IdeaAgentJobDto> = {};
  for (const job of linkedJobs) {
    if (job) {
      agentJobsById[job.id] = toAgentJobDto(job);
    }
  }

  const ideas: IdeaDto[] = ideaRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    transcript: parseDevIdeaTranscript(row.chatTranscript),
    generatedPrompt: row.generatedPrompt,
    devAgentJobId: row.devAgentJobId,
    updatedAt: row.updatedAt.toISOString(),
  }));

  const config = resolveAgentJobsConfig();

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Ideen" }]} />}>
      <PageHeader
        title="Ideen-Management"
        summary="Ideen sammeln, im KI-Chat (lokal RTX oder Cloud) schärfen und als Prompt direkt an Cursor übergeben."
      />
      <IdeaWorkspaceClient
        ideas={ideas}
        agentJobsById={agentJobsById}
        initialSelectedId={selectedParam ?? ideas[0]?.id ?? null}
        agentJobs={{
          enabled: config.enabled,
          cursorConfigured: config.cursorCloudConfigured,
          defaultProvider: config.defaultProvider,
        }}
      />
      <p className="uwe-dashboard-muted">
        <Link href="/today">← Heute</Link>
      </p>
    </StudioShell>
  );
}
