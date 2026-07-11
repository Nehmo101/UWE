import Link from "next/link";
import {
  DEV_AGENT_JOB_PROVIDER_LABELS,
  DEV_AGENT_JOB_STATUS_LABELS,
  createDevAgentJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { AGENT_JOB_PRESETS } from "@uwe/agent-jobs";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { AgentJobRetryButton, AgentJobsPoller } from "@/components/AgentJobsPoller";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
import { createAgentJobAction, createAgentJobFromPresetAction } from "../../integration-actions";

function CollapsedWhenDisabled({
  enabled,
  summary,
  children,
}: {
  enabled: boolean;
  summary: string;
  children: React.ReactNode;
}) {
  if (enabled) return <>{children}</>;
  return (
    <details>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

export default async function AgentJobsPage() {
  const config = resolveAgentJobsConfig();
  const agentJobs = createDevAgentJobService(prisma);
  const jobs = await agentJobs.listJobs(30);
  const runningJobIds = jobs
    .filter((job) => job.status === "pending" || job.status === "dispatched" || job.status === "running")
    .map((job) => job.id);

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Cursor Agent Jobs" }]}
        />
      }
    >
      <PageHeader
        title="Cursor Agent Jobs"
        summary="Entwicklungs-Prompts als GitHub-Actions- oder Cursor-Cloud-Jobs — Ergebnis: Branch/PR, kein Auto-Merge."
      />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={config.enabled ? "success" : "secondary"}>
            Agent Jobs: {config.enabled ? "aktiv" : "deaktiviert"}
          </Badge>
          <Badge>GitHub Repo: {config.githubRepo ?? "—"}</Badge>
          <Badge variant={config.githubTokenConfigured ? "success" : "danger"}>
            GitHub Token: {config.githubTokenConfigured ? "gesetzt" : "fehlt"}
          </Badge>
          <Badge variant={config.cursorCloudConfigured ? "success" : "secondary"}>
            Cursor Cloud: {config.cursorCloudConfigured ? "gesetzt" : "fehlt"}
          </Badge>
          <Badge variant={config.autoMerge ? "danger" : "success"}>
            Auto-Merge: {config.autoMerge ? "AN (Warnung!)" : "aus"}
          </Badge>
        </CardContent>
      </Card>

      {!config.enabled && (
        <Alert tone="warning" role="alert" className="mb-4">
          Agent Jobs sind deaktiviert — Jobs können nicht gestartet werden. Setze
          AGENT_JOBS_ENABLED=true und AGENT_JOBS_GITHUB_REPO=owner/repo. Die Formulare unten sind
          eingeklappt, bis die Integration aktiv ist.
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1-Klick-Presets</CardTitle>
          <CardDescription>
            Wiederkehrende Dev-Jobs mit fertigem Prompt-Template — Parameter ausfüllen, Job
            startet über dieselbe Queue. Presets transportieren keine Weltdaten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollapsedWhenDisabled enabled={config.enabled} summary="Presets anzeigen (Integration deaktiviert)">
            {AGENT_JOB_PRESETS.map((preset) => (
              <details key={preset.id} className="mt-3">
                <summary>
                  <strong>{preset.label}</strong>{" "}
                  <span className="text-sm text-muted-foreground">— {preset.summary}</span>
                </summary>
                <form action={createAgentJobFromPresetAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="preset" value={preset.id} />
                  {preset.fields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <Label htmlFor={`preset-${preset.id}-${field.key}`}>{field.label}</Label>
                      {field.multiline ? (
                        <Textarea
                          id={`preset-${preset.id}-${field.key}`}
                          name={`field:${field.key}`}
                          rows={4}
                          required={field.required}
                          placeholder={field.placeholder}
                        />
                      ) : (
                        <Input
                          id={`preset-${preset.id}-${field.key}`}
                          name={`field:${field.key}`}
                          required={field.required}
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`preset-${preset.id}-provider`}>Provider</Label>
                    <Select name="provider" defaultValue={config.defaultProvider}>
                      <SelectTrigger id={`preset-${preset.id}-provider`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEV_AGENT_JOB_PROVIDER_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button type="submit" disabled={!config.enabled}>
                      Preset-Job starten
                    </Button>
                  </div>
                </form>
              </details>
            ))}
          </CollapsedWhenDisabled>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Neuer Agent-Job</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CollapsedWhenDisabled enabled={config.enabled} summary="Formular anzeigen (Integration deaktiviert)">
            <form action={createAgentJobAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-job-title">Titel</Label>
                <Input
                  id="agent-job-title"
                  name="title"
                  required
                  placeholder="feat: Image Studio mobile polish"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-job-provider">Provider</Label>
                <Select name="provider" defaultValue={config.defaultProvider}>
                  <SelectTrigger id="agent-job-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEV_AGENT_JOB_PROVIDER_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-job-prompt">Prompt</Label>
                <Textarea
                  id="agent-job-prompt"
                  name="prompt"
                  required
                  rows={8}
                  placeholder="Implementiere … ohne Auto-Merge. Branch cursor/…"
                />
              </div>
              <div>
                <Button type="submit" disabled={!config.enabled}>
                  Job starten
                </Button>
              </div>
            </form>
            <p className="text-sm text-muted-foreground">
              Workflow: <code>.github/workflows/cursor-agent.yml</code> · Dispatch-Status auch in
              der <Link href="/jobs">Hintergrund-Job-Warteschlange</Link> (Typ Agent-Job) ·
              Verwaltung und Presets auf dieser Seite.
            </p>
            <Alert tone="warning" role="alert" className="mt-3">
              Sicherheit: Prompts werden an GitHub Actions oder Cursor Cloud gesendet. Keine
              Weltdaten, Brain-Inhalte, Passwörter oder API-Keys in den Prompt einfügen.
            </Alert>
          </CollapsedWhenDisabled>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Verlauf</h2>
        <AgentJobsPoller runningJobIds={runningJobIds} />
        {jobs.length === 0 ? (
          <EmptyState title="Noch keine Agent-Jobs" description="Erstelle einen Job oben." />
        ) : (
          <ul className="grid gap-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{job.title}</strong>
                      <Badge>{DEV_AGENT_JOB_STATUS_LABELS[job.status]}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {DEV_AGENT_JOB_PROVIDER_LABELS[job.provider]}
                      </span>
                    </div>
                    {job.branchName && <p className="text-sm">Branch: {job.branchName}</p>}
                    {job.prUrl && (
                      <a
                        href={job.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        PR öffnen
                      </a>
                    )}
                    {job.errorMessage && (
                      <p className="text-sm text-destructive" role="alert">
                        {job.errorMessage}
                      </p>
                    )}
                    {(job.status === "failed" || job.status === "cancelled") && (
                      <AgentJobRetryButton jobId={job.id} disabled={!config.enabled} />
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SystemShell>
  );
}
