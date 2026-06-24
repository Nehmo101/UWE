import Link from "next/link";
import {
  EmptyState,
} from "@uwe/shared-ui";
import {
  DEV_AGENT_JOB_PROVIDER_LABELS,
  DEV_AGENT_JOB_STATUS_LABELS,
  createDevAgentJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { AgentJobRetryButton, AgentJobsPoller } from "@/components/AgentJobsPoller";
import { createAgentJobAction } from "../../integration-actions";

export default async function AgentJobsPage() {
  const config = resolveAgentJobsConfig();
  const agentJobs = createDevAgentJobService(prisma);
  const jobs = await agentJobs.listJobs(30);
  const runningJobIds = jobs
    .filter((job) => job.status === "pending" || job.status === "dispatched" || job.status === "running")
    .map((job) => job.id);

  return (
    <AdminModuleShell
      activePath="/admin/agent-jobs"
      title="Cursor Agent Jobs"
      summary="Entwicklungs-Prompts als GitHub-Actions- oder Cursor-Cloud-Jobs — Ergebnis: Branch/PR, kein Auto-Merge."
    >
          <section className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
            <h2>Status</h2>
            <ul className="uwe-dashboard-muted">
              <li>Agent Jobs: {config.enabled ? "aktiv" : "deaktiviert"}</li>
              <li>GitHub Repo: {config.githubRepo ?? "—"}</li>
              <li>GitHub Token: {config.githubTokenConfigured ? "gesetzt" : "fehlt"}</li>
              <li>Cursor Cloud: {config.cursorCloudConfigured ? "gesetzt" : "fehlt"}</li>
              <li>Auto-Merge: {config.autoMerge ? "AN (Warnung!)" : "aus"}</li>
            </ul>
          </section>

          {!config.enabled && (
            <p className="uwe-notice uwe-notice-warn">
              Setze AGENT_JOBS_ENABLED=true und AGENT_JOBS_GITHUB_REPO=owner/repo
            </p>
          )}

          <section className="uwe-v2-card uwe-form" style={{ marginBottom: "1.5rem" }}>
            <h2>Neuer Agent-Job</h2>
            <form action={createAgentJobAction} className="uwe-form">
              <label>
                Titel
                <input name="title" required placeholder="feat: Image Studio mobile polish" />
              </label>
              <label>
                Provider
                <select name="provider" defaultValue={config.defaultProvider}>
                  {Object.entries(DEV_AGENT_JOB_PROVIDER_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prompt
                <textarea
                  name="prompt"
                  required
                  rows={8}
                  placeholder="Implementiere … ohne Auto-Merge. Branch cursor/…"
                />
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={!config.enabled}>
                Job starten
              </button>
            </form>
            <p className="uwe-hint">
              Workflow: <code>.github/workflows/cursor-agent.yml</code> · Fortschritt unter{" "}
              <Link href="/jobs">Jobs</Link>
            </p>
            <p className="uwe-notice uwe-notice-warn" style={{ marginTop: "0.75rem" }}>
              Sicherheit: Prompts werden an GitHub Actions oder Cursor Cloud gesendet. Keine
              Weltdaten, Brain-Inhalte, Passwörter oder API-Keys in den Prompt einfügen.
            </p>
          </section>

          <section>
            <h2 className="uwe-v2-section-title">Verlauf</h2>
            <AgentJobsPoller runningJobIds={runningJobIds} />
            {jobs.length === 0 ? (
              <EmptyState title="Noch keine Agent-Jobs" description="Erstelle einen Job oben." />
            ) : (
              <ul className="uwe-list-cards">
                {jobs.map((job) => (
                  <li key={job.id} className="uwe-list-card">
                    <strong>{job.title}</strong>
                    <span className="uwe-badge">{DEV_AGENT_JOB_STATUS_LABELS[job.status]}</span>
                    <span className="uwe-dashboard-muted">
                      {DEV_AGENT_JOB_PROVIDER_LABELS[job.provider]}
                    </span>
                    {job.branchName && <p>Branch: {job.branchName}</p>}
                    {job.prUrl && (
                      <a href={job.prUrl} target="_blank" rel="noreferrer">
                        PR öffnen
                      </a>
                    )}
                    {job.errorMessage && <p className="uwe-notice-warn">{job.errorMessage}</p>}
                    {(job.status === "failed" || job.status === "cancelled") && (
                      <AgentJobRetryButton jobId={job.id} disabled={!config.enabled} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
    </AdminModuleShell>
  );
}
