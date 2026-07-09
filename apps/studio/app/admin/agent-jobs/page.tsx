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
import { AGENT_JOB_PRESETS } from "@uwe/agent-jobs";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { AgentJobRetryButton, AgentJobsPoller } from "@/components/AgentJobsPoller";
import { createAgentJobAction, createAgentJobFromPresetAction } from "../../integration-actions";

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

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2>1-Klick-Presets</h2>
        <p className="uwe-dashboard-muted">
          Wiederkehrende Dev-Jobs mit fertigem Prompt-Template — Parameter ausfüllen, Job
          startet über dieselbe Queue. Presets transportieren keine Weltdaten.
        </p>
        {AGENT_JOB_PRESETS.map((preset) => (
          <details key={preset.id} style={{ marginTop: "0.75rem" }}>
            <summary>
              <strong>{preset.label}</strong>{" "}
              <span className="uwe-dashboard-muted">— {preset.summary}</span>
            </summary>
            <form action={createAgentJobFromPresetAction} className="uwe-form">
              <input type="hidden" name="preset" value={preset.id} />
              {preset.fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      name={`field:${field.key}`}
                      rows={4}
                      required={field.required}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      name={`field:${field.key}`}
                      required={field.required}
                      placeholder={field.placeholder}
                    />
                  )}
                </label>
              ))}
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
              <button
                type="submit"
                className="uwe-v2-btn uwe-v2-btn-primary"
                disabled={!config.enabled}
              >
                Preset-Job starten
              </button>
            </form>
          </details>
        ))}
      </section>

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
          Workflow: <code>.github/workflows/cursor-agent.yml</code> · Dispatch-Status auch in der{" "}
          <Link href="/jobs">Hintergrund-Job-Warteschlange</Link> (Typ Agent-Job) · Verwaltung und
          Presets auf dieser Seite.
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
    </SystemShell>
  );
}
