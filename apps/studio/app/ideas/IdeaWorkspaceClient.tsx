"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  createIdeaAction,
  deleteIdeaAction,
  updateIdeaAction,
  updateIdeaStatusAction,
} from "../ideas-actions";

export type IdeaStatus = "in_planning" | "implemented" | "rejected";
export type ProviderMode = "auto" | "local_rtx" | "cloud";

export interface IdeaChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  via?: string;
}

export interface IdeaDto {
  id: string;
  title: string;
  body: string;
  status: IdeaStatus;
  transcript: IdeaChatMessage[];
  generatedPrompt: string | null;
  devAgentJobId: string | null;
  updatedAt: string;
}

export interface IdeaAgentJobDto {
  id: string;
  status: string;
  provider: string;
  branchName: string | null;
  prUrl: string | null;
  errorMessage: string | null;
  summary: string | null;
  url: string | null;
}

interface IdeaWorkspaceClientProps {
  ideas: IdeaDto[];
  agentJobsById: Record<string, IdeaAgentJobDto>;
  initialSelectedId: string | null;
  agentJobs: { enabled: boolean; cursorConfigured: boolean; defaultProvider: string };
}

const STATUS_LABELS: Record<IdeaStatus, string> = {
  in_planning: "In Planung",
  implemented: "Umgesetzt",
  rejected: "Abgelehnt",
};

const STATUS_ORDER: IdeaStatus[] = ["in_planning", "implemented", "rejected"];

const PROVIDER_LABELS: Record<ProviderMode, string> = {
  auto: "Automatisch",
  local_rtx: "Lokal (RTX)",
  cloud: "Cloud",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Wartend",
  dispatched: "Abgesendet",
  running: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

const RUNNING_JOB_STATUSES = new Set(["pending", "dispatched", "running"]);

function statusBadgeClass(status: IdeaStatus): string {
  switch (status) {
    case "implemented":
      return "uwe-badge uwe-badge-success";
    case "rejected":
      return "uwe-badge uwe-badge-danger";
    default:
      return "uwe-badge uwe-badge-warning";
  }
}

function jobBadgeClass(status: string): string {
  if (status === "completed") return "uwe-badge uwe-badge-success";
  if (status === "failed" || status === "cancelled") return "uwe-badge uwe-badge-danger";
  return "uwe-badge uwe-badge-warning";
}

export function IdeaWorkspaceClient({
  ideas: initialIdeas,
  agentJobsById: initialJobs,
  initialSelectedId,
  agentJobs,
}: IdeaWorkspaceClientProps) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaDto[]>(initialIdeas);
  const [jobs, setJobs] = useState<Record<string, IdeaAgentJobDto>>(initialJobs);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? initialIdeas[0]?.id ?? null,
  );

  useEffect(() => {
    setIdeas(initialIdeas);
  }, [initialIdeas]);
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const selected = useMemo(
    () => ideas.find((idea) => idea.id === selectedId) ?? null,
    [ideas, selectedId],
  );

  function patchIdea(id: string, patch: Partial<IdeaDto>) {
    setIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea)));
  }

  return (
    <div className="uwe-v2-dashboard-grid" data-columns="3">
      <IdeaListColumn
        ideas={ideas}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ChatColumn
        key={`chat-${selected?.id ?? "none"}`}
        idea={selected}
        onTranscript={(transcript) => selected && patchIdea(selected.id, { transcript })}
      />
      <PromptColumn
        key={`prompt-${selected?.id ?? "none"}`}
        idea={selected}
        job={selected?.devAgentJobId ? (jobs[selected.devAgentJobId] ?? null) : null}
        agentJobs={agentJobs}
        onPrompt={(generatedPrompt) => selected && patchIdea(selected.id, { generatedPrompt })}
        onDispatched={(job) => {
          if (!selected) return;
          patchIdea(selected.id, { devAgentJobId: job.id });
          setJobs((current) => ({ ...current, [job.id]: job }));
        }}
        onJobUpdate={(job) => setJobs((current) => ({ ...current, [job.id]: job }))}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}

function IdeaListColumn({
  ideas,
  selectedId,
  onSelect,
}: {
  ideas: IdeaDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Ideen ({ideas.length})</h2>

      <form action={createIdeaAction} className="uwe-brain-create-form">
        <label>
          Neue Idee (Überschrift)
          <input name="title" required placeholder="z. B. Dark-Mode für Portal" />
        </label>
        <label>
          Beschreibung
          <textarea name="body" rows={2} placeholder="Worum geht es?" />
        </label>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
          Idee anlegen
        </button>
      </form>

      {ideas.length === 0 ? (
        <p className="uwe-dashboard-muted">Noch keine Ideen — lege oben eine an.</p>
      ) : (
        <ul className="uwe-idea-list">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className={`uwe-idea-list-item${idea.id === selectedId ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="uwe-idea-list-select"
                aria-pressed={idea.id === selectedId}
                onClick={() => onSelect(idea.id)}
              >
                <span className="uwe-idea-list-title">{idea.title}</span>
                <span className={statusBadgeClass(idea.status)}>{STATUS_LABELS[idea.status]}</span>
              </button>
              <div className="uwe-idea-list-actions">
                <form action={updateIdeaStatusAction} className="uwe-idea-status-form">
                  <input type="hidden" name="id" value={idea.id} />
                  <select name="status" defaultValue={idea.status} aria-label="Status">
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Setzen
                  </button>
                </form>
                <form action={deleteIdeaAction}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChatColumn({
  idea,
  onTranscript,
}: {
  idea: IdeaDto | null;
  onTranscript: (transcript: IdeaChatMessage[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [providerMode, setProviderMode] = useState<ProviderMode>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (!idea) {
    return (
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">KI-Chat</h2>
        <p className="uwe-dashboard-muted">Wähle links eine Idee aus, um sie zu besprechen.</p>
      </section>
    );
  }

  async function send() {
    const trimmed = message.trim();
    if (!trimmed || busy || !idea) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(studioApiUrl(`/api/ideas/${idea.id}/chat`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, providerMode }),
      });
      const data = (await res.json()) as {
        transcript?: IdeaChatMessage[];
        deferred?: boolean;
        message?: string;
        error?: string;
      };
      if (res.status === 202 && data.deferred) {
        setInfo(data.message ?? "Anfrage als Job vorgemerkt.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "KI-Anfrage fehlgeschlagen.");
      }
      if (data.transcript) {
        onTranscript(data.transcript);
      }
      setMessage("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "KI-Anfrage fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">KI-Chat</h2>

      <div className="uwe-idea-detail">
        <div className="uwe-idea-detail-head">
          <h3 className="uwe-idea-detail-title">{idea.title}</h3>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Schließen" : "Bearbeiten"}
          </button>
        </div>
        {editing ? (
          <form action={updateIdeaAction} className="uwe-brain-create-form">
            <input type="hidden" name="id" value={idea.id} />
            <label>
              Überschrift
              <input name="title" defaultValue={idea.title} required />
            </label>
            <label>
              Beschreibung (Fließtext)
              <textarea name="body" rows={4} defaultValue={idea.body} />
            </label>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
              Speichern
            </button>
          </form>
        ) : (
          idea.body && <p className="uwe-idea-detail-body">{idea.body}</p>
        )}
      </div>

      <div className="uwe-idea-chat-log" aria-label="Chatverlauf">
        {idea.transcript.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Noch kein Verlauf. Übernimm die Idee als Fließtext und lass die KI nachfragen.
          </p>
        ) : (
          idea.transcript.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`uwe-idea-chat-msg uwe-idea-chat-msg-${msg.role}`}
            >
              <span className="uwe-idea-chat-role">
                {msg.role === "user" ? "Du" : "KI"}
                {msg.via ? ` · ${msg.via === "local_rtx" ? "RTX" : "Cloud"}` : ""}
              </span>
              <p className="uwe-idea-chat-text">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="uwe-idea-chat-controls">
        <label className="uwe-idea-provider">
          KI-Quelle
          <select
            value={providerMode}
            onChange={(event) => setProviderMode(event.target.value as ProviderMode)}
            disabled={busy}
          >
            {(Object.keys(PROVIDER_LABELS) as ProviderMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {PROVIDER_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
          onClick={() => setMessage(idea.body || idea.title)}
          disabled={busy}
        >
          Idee als Fließtext übernehmen
        </button>
      </div>

      <label className="uwe-idea-chat-field">
        Nachricht an die KI
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          placeholder="Frage stellen, Idee einfügen oder Anweisung geben…"
          disabled={busy}
        />
      </label>

      {info && <p className="uwe-notice-warn">{info}</p>}
      {error && <p className="uwe-notice-warn">{error}</p>}

      <button
        type="button"
        className="uwe-v2-btn uwe-v2-btn-primary"
        onClick={() => void send()}
        disabled={busy || message.trim().length === 0}
      >
        {busy ? "KI antwortet…" : "Senden"}
      </button>
    </section>
  );
}

function PromptColumn({
  idea,
  job,
  agentJobs,
  onPrompt,
  onDispatched,
  onJobUpdate,
  onRefresh,
}: {
  idea: IdeaDto | null;
  job: IdeaAgentJobDto | null;
  agentJobs: { enabled: boolean; cursorConfigured: boolean; defaultProvider: string };
  onPrompt: (prompt: string) => void;
  onDispatched: (job: IdeaAgentJobDto) => void;
  onJobUpdate: (job: IdeaAgentJobDto) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState(idea?.generatedPrompt ?? "");
  const [providerMode, setProviderMode] = useState<ProviderMode>("auto");
  const [genBusy, setGenBusy] = useState(false);
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(idea?.generatedPrompt ?? "");
  }, [idea?.id, idea?.generatedPrompt]);

  // Poll the linked Cursor agent while it is still running.
  useEffect(() => {
    if (!job || !RUNNING_JOB_STATUSES.has(job.status)) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    const jobId = job.id;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(studioApiUrl(`/api/agent-jobs/${jobId}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll" }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as { job?: RawJob; cursorStatus?: { summary?: string | null; url?: string | null } };
          if (data.job) {
            onJobUpdate(toJobDto(data.job, data.cursorStatus));
          }
        } catch {
          // best effort
        }
      })();
    }, 5000);
    pollRef.current = timer;
    return () => window.clearInterval(timer);
  }, [job, onJobUpdate]);

  if (!idea) {
    return (
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Aktueller Prompt</h2>
        <p className="uwe-dashboard-muted">Wähle eine Idee, um einen Cursor-Prompt zu erstellen.</p>
      </section>
    );
  }

  async function generate() {
    if (genBusy || !idea) return;
    setGenBusy(true);
    setError(null);
    try {
      const res = await fetch(studioApiUrl(`/api/ideas/${idea.id}/prompt`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerMode }),
      });
      const data = (await res.json()) as { generatedPrompt?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Prompt-Erstellung fehlgeschlagen.");
      }
      const prompt = data.generatedPrompt ?? "";
      setDraft(prompt);
      onPrompt(prompt);
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : "Prompt-Erstellung fehlgeschlagen.");
    } finally {
      setGenBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Kopieren nicht möglich.");
    }
  }

  async function dispatch() {
    if (dispatchBusy || !idea || draft.trim().length === 0) return;
    setDispatchBusy(true);
    setError(null);
    try {
      const res = await fetch(studioApiUrl(`/api/ideas/${idea.id}/dispatch`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: draft }),
      });
      const data = (await res.json()) as { job?: RawJob; error?: string };
      if (!res.ok || !data.job) {
        throw new Error(data.error ?? "Übergabe an Cursor fehlgeschlagen.");
      }
      onDispatched(toJobDto(data.job));
      onRefresh();
    } catch (dispatchError) {
      setError(
        dispatchError instanceof Error ? dispatchError.message : "Übergabe an Cursor fehlgeschlagen.",
      );
    } finally {
      setDispatchBusy(false);
    }
  }

  const dispatchDisabled =
    dispatchBusy || draft.trim().length === 0 || !agentJobs.enabled;

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Aktueller Prompt</h2>

      <div className="uwe-idea-chat-controls">
        <label className="uwe-idea-provider">
          KI-Quelle
          <select
            value={providerMode}
            onChange={(event) => setProviderMode(event.target.value as ProviderMode)}
            disabled={genBusy}
          >
            {(Object.keys(PROVIDER_LABELS) as ProviderMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {PROVIDER_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
          onClick={() => void generate()}
          disabled={genBusy}
        >
          {genBusy ? "Erstelle…" : "Prompt erstellen"}
        </button>
      </div>

      <textarea
        className="uwe-idea-prompt-text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={10}
        placeholder="Hier erscheint der aus dem KI-Chat erzeugte Cursor-Prompt. Du kannst ihn vor der Übergabe anpassen."
      />

      <div className="uwe-idea-prompt-actions">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => void copy()}
          disabled={draft.trim().length === 0}
        >
          {copied ? "Kopiert!" : "Kopieren"}
        </button>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          onClick={() => void dispatch()}
          disabled={dispatchDisabled}
          title={!agentJobs.enabled ? "Agent Jobs sind deaktiviert (AGENT_JOBS_ENABLED)." : undefined}
        >
          {dispatchBusy ? "Übergebe…" : "An Cursor übergeben"}
        </button>
      </div>

      {!agentJobs.enabled && (
        <p className="uwe-dashboard-muted">
          Cursor-Übergabe inaktiv — setze <code>AGENT_JOBS_ENABLED=true</code> und
          <code> CURSOR_CLOUD_API_KEY</code>. Der Prompt kann trotzdem kopiert werden.
        </p>
      )}
      {agentJobs.enabled && !agentJobs.cursorConfigured && (
        <p className="uwe-dashboard-muted">
          Hinweis: <code>CURSOR_CLOUD_API_KEY</code> fehlt — Übergabe schlägt fehl, Kopieren geht.
        </p>
      )}
      {error && <p className="uwe-notice-warn">{error}</p>}

      <CursorStatusPanel job={job} />
    </section>
  );
}

function CursorStatusPanel({ job }: { job: IdeaAgentJobDto | null }) {
  if (!job) {
    return (
      <div className="uwe-idea-cursor-status">
        <h3 className="uwe-v2-section-title">Cursor-Status</h3>
        <p className="uwe-dashboard-muted">Noch nicht an Cursor übergeben.</p>
      </div>
    );
  }

  return (
    <div className="uwe-idea-cursor-status">
      <h3 className="uwe-v2-section-title">Cursor-Status</h3>
      <p>
        <span className={jobBadgeClass(job.status)}>
          {JOB_STATUS_LABELS[job.status] ?? job.status}
        </span>
        {RUNNING_JOB_STATUSES.has(job.status) && (
          <span className="uwe-dashboard-muted"> · Aktualisierung alle 5 s</span>
        )}
      </p>
      {job.summary && <p className="uwe-idea-cursor-summary">{job.summary}</p>}
      <ul className="uwe-idea-cursor-links">
        {job.url && (
          <li>
            <a href={job.url} target="_blank" rel="noreferrer">
              Agent in Cursor öffnen
            </a>
          </li>
        )}
        {job.branchName && <li>Branch: <code>{job.branchName}</code></li>}
        {job.prUrl && (
          <li>
            <a href={job.prUrl} target="_blank" rel="noreferrer">
              Pull Request
            </a>
          </li>
        )}
      </ul>
      {job.errorMessage && <p className="uwe-notice-warn">{job.errorMessage}</p>}
    </div>
  );
}

interface RawJob {
  id: string;
  status: string;
  provider: string;
  branchName?: string | null;
  prUrl?: string | null;
  errorMessage?: string | null;
  result?: unknown;
}

function toJobDto(
  job: RawJob,
  cursorStatus?: { summary?: string | null; url?: string | null },
): IdeaAgentJobDto {
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
    branchName: job.branchName ?? null,
    prUrl: job.prUrl ?? null,
    errorMessage: job.errorMessage ?? null,
    summary: cursorStatus?.summary ?? cursor?.summary ?? null,
    url: cursorStatus?.url ?? cursor?.url ?? null,
  };
}
