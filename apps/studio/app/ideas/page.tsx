import Link from "next/link";
import {
  createDevIdeaService,
  parseDevIdeaTranscript,
  parseIdeaAttachments,
  prisma,
} from "@uwe/database/server";
import {
  IDEA_WORKSPACE_VIEW_LABELS,
  parseIdeaWorkspaceView,
  type IdeaWorkspaceView,
} from "@uwe/database/dev-idea-constants";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireOwner } from "@/src/lib/auth";
import { IdeaWorkspaceClient, type IdeaDto } from "./IdeaWorkspaceClient";

interface IdeasPageProps {
  searchParams: Promise<{ idea?: string; view?: string; lifecycle?: string; module?: string }>;
}

const VIEW_SUMMARIES: Record<IdeaWorkspaceView, string> = {
  all: "Ideen sammeln, im KI-Chat schärfen und als Prompt herauskopieren — mit Typ, Lifecycle und Modul.",
  features: "Feature-Registry: vorhandene und geplante UWE-Funktionen mit Lifecycle-Status, Modul und Reifegrad.",
  prompts: "Prompt-Bibliothek: gespeicherte Entwicklungs-Prompts aus dem Ideen-Workflow.",
};

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  await requireOwner();
  const { idea: selectedParam, view: viewParam, lifecycle, module } = await searchParams;
  const view = parseIdeaWorkspaceView(viewParam);
  const ideaService = createDevIdeaService(prisma);
  const ideaRows = await ideaService.listIdeas({ limit: 200 });
  const ideas: IdeaDto[] = ideaRows.map((row) => ({
    id: row.id, title: row.title, body: row.body, status: row.status,
    ideaType: row.ideaType, lifecycle: row.lifecycle, module: row.module, maturityLevel: row.maturityLevel,
    transcript: parseDevIdeaTranscript(row.chatTranscript), generatedPrompt: row.generatedPrompt,
    attachments: parseIdeaAttachments(row.attachments),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const pageTitle = view === "all" ? "Ideen-Management" : IDEA_WORKSPACE_VIEW_LABELS[view];
  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Ideen" }]} />}>
      <PageHeader title={pageTitle} summary={VIEW_SUMMARIES[view]} />
      <IdeaWorkspaceClient
        ideas={ideas}
        initialSelectedId={selectedParam ?? ideas[0]?.id ?? null}
        initialView={view}
        initialLifecycleFilter={lifecycle ?? null}
        initialModuleFilter={module ?? null}
      />
      <p className="text-sm text-muted-foreground"><Link href="/worlds">← Welten</Link></p>
    </StudioShell>
  );
}
