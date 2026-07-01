"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEV_IDEA_LIFECYCLE_LABELS, DEV_IDEA_LIFECYCLES, DEV_IDEA_MATURITY_LABELS, DEV_IDEA_MATURITY_LEVELS,
  DEV_IDEA_MODULE_LABELS, DEV_IDEA_MODULES, DEV_IDEA_TYPE_LABELS, DEV_IDEA_TYPES,
  IDEA_WORKSPACE_VIEW_LABELS, IDEA_WORKSPACE_VIEWS,
  type DevIdeaLifecycleId, type DevIdeaMaturityLevelId, type DevIdeaModuleId, type DevIdeaTypeId, type IdeaWorkspaceView,
} from "@uwe/database/dev-idea-constants";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  createIdeaAction,
  deleteIdeaAction,
  syncFeatureMatrixAction,
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
  ideaType: DevIdeaTypeId;
  lifecycle: DevIdeaLifecycleId;
  module: string | null;
  maturityLevel: string | null;
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
  initialView: IdeaWorkspaceView;
  initialLifecycleFilter: string | null;
  initialModuleFilter: string | null;
  agentJobs: {
    enabled: boolean;
    cursorConfigured: boolean;
    githubRepo: string | null;
    defaultBranch: string;
    defaultProvider: string;
  };
}

type WorkspaceContext = {
  view: IdeaWorkspaceView;
  lifecycle: string | null;
  module: string | null;
};

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


function lifecycleBadgeClass(lifecycle: DevIdeaLifecycleId): string { switch (lifecycle) { case "existing": return "uwe-badge uwe-badge-success"; case "broken": return "uwe-badge uwe-badge-danger"; case "deprecated": return "uwe-badge uwe-badge-draft"; default: return "uwe-badge uwe-badge-warning"; } }
function moduleLabel(module: string | null): string | null { if (!module) return null; return DEV_IDEA_MODULE_LABELS[module as DevIdeaModuleId] ?? module; }
function maturityLabel(maturity: string | null): string | null { if (!maturity) return null; return DEV_IDEA_MATURITY_LABELS[maturity as DevIdeaMaturityLevelId] ?? maturity; }
function truncatePrompt(text: string, max = 120): string { const trimmed = text.trim(); return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`; }
function buildIdeasHref(options: { view: IdeaWorkspaceView; lifecycle?: string | null; module?: string | null; idea?: string | null; }): string { const params = new URLSearchParams(); if (options.view !== "all") params.set("view", options.view); if (options.lifecycle) params.set("lifecycle", options.lifecycle); if (options.module) params.set("module", options.module); if (options.idea) params.set("idea", options.idea); const q = params.toString(); return q ? `/ideas?${q}` : "/ideas"; }

function jobBadgeClass(status: string): string {
  if (status === "completed") return "uwe-badge uwe-badge-success";
  if (status === "failed" || status === "cancelled") return "uwe-badge uwe-badge-danger";
  return "uwe-badge uwe-badge-warning";
}

export function IdeaWorkspaceClient({
  ideas: initialIdeas,
  agentJobsById: initialJobs,
  initialSelectedId,
  initialView,
  initialLifecycleFilter,
  initialModuleFilter,
  agentJobs,
}: IdeaWorkspaceClientProps) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaDto[]>(initialIdeas);
  const [jobs, setJobs] = useState<Record<string, IdeaAgentJobDto>>(initialJobs);
  const view = initialView;
  const lifecycleFilter = initialLifecycleFilter;
  const moduleFilter = initialModuleFilter;
  const workspaceContext: WorkspaceContext = { view, lifecycle: lifecycleFilter, module: moduleFilter };

  useEffect(() => { setIdeas(initialIdeas); }, [initialIdeas]);
  useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  const filteredIdeas = useMemo(() => ideas.filter((idea) => {
    if (view === "features" && idea.ideaType !== "feature") return false;
    if (view === "prompts" && idea.ideaType !== "prompt") return false;
    if (lifecycleFilter && idea.lifecycle !== lifecycleFilter) return false;
    if (moduleFilter && idea.module !== moduleFilter) return false;
    return true;
  }), [ideas, view, lifecycleFilter, moduleFilter]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? filteredIdeas[0]?.id ?? null);
  useEffect(() => { setSelectedId(initialSelectedId ?? filteredIdeas[0]?.id ?? null); }, [initialSelectedId, filteredIdeas]);
  const selected = useMemo(() => filteredIdeas.find((i) => i.id === selectedId) ?? filteredIdeas[0] ?? null, [filteredIdeas, selectedId]);
  function patchIdea(id: string, patch: Partial<IdeaDto>) {
    setIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea)));
  }

  return (
    <div className="uwe-v2-dashboard-grid" data-columns="3">
      <IdeaListColumn ideas={filteredIdeas} selectedId={selected?.id ?? null} onSelect={setSelectedId} view={view} lifecycleFilter={lifecycleFilter} moduleFilter={moduleFilter} workspaceContext={workspaceContext} />
      <ChatColumn key={`chat-${selected?.id ?? "none"}`} idea={selected} workspaceContext={workspaceContext} onTranscript={(transcript) => selected && patchIdea(selected.id, { transcript })} />
      <PromptColumn key={`prompt-${selected?.id ?? "none"}`} idea={selected} highlightPrompt={view === "prompts"} job={selected?.devAgentJobId ? (jobs[selected.devAgentJobId] ?? null) : null} agentJobs={agentJobs} onPrompt={(p) => selected && patchIdea(selected.id, { generatedPrompt: p })} onDispatched={(job) => { if (!selected) return; patchIdea(selected.id, { devAgentJobId: job.id }); setJobs((c) => ({ ...c, [job.id]: job })); }} onJobUpdate={(job) => setJobs((c) => ({ ...c, [job.id]: job }))} onRefresh={() => router.refresh()} />
    </div>
  );
}

function IdeaRegistryFields({ ideaTypeDefault = "feature", lifecycleDefault = "planned", moduleDefault = "", maturityDefault = "" }: { ideaTypeDefault?: DevIdeaTypeId; lifecycleDefault?: DevIdeaLifecycleId; moduleDefault?: string; maturityDefault?: string; }) {
  return (<>
    <label>Typ<select name="ideaType" defaultValue={ideaTypeDefault}>{DEV_IDEA_TYPES.map((type) => (<option key={type} value={type}>{DEV_IDEA_TYPE_LABELS[type]}</option>))}</select></label>
    <label>Lifecycle<select name="lifecycle" defaultValue={lifecycleDefault}>{DEV_IDEA_LIFECYCLES.map((l) => (<option key={l} value={l}>{DEV_IDEA_LIFECYCLE_LABELS[l]}</option>))}</select></label>
    <label>Modul<select name="module" defaultValue={moduleDefault}><option value="">— keins —</option>{DEV_IDEA_MODULES.map((m) => (<option key={m} value={m}>{DEV_IDEA_MODULE_LABELS[m]}</option>))}</select></label>
    <label>Reifegrad<select name="maturityLevel" defaultValue={maturityDefault}><option value="">— keiner —</option>{DEV_IDEA_MATURITY_LEVELS.map((l) => (<option key={l} value={l}>{DEV_IDEA_MATURITY_LABELS[l]}</option>))}</select></label>
  </>);
}

function WorkspaceContextFields({ view, lifecycle, module }: WorkspaceContext) {
  return (<><input type="hidden" name="view" value={view} />{lifecycle ? <input type="hidden" name="lifecycle" value={lifecycle} /> : null}{module ? <input type="hidden" name="module" value={module} /> : null}</>);
}

function IdeaListColumn({ ideas, selectedId, onSelect, view, lifecycleFilter, moduleFilter, workspaceContext }: { ideas: IdeaDto[]; selectedId: string | null; onSelect: (id: string) => void; view: IdeaWorkspaceView; lifecycleFilter: string | null; moduleFilter: string | null; workspaceContext: WorkspaceContext; }) {
  const createIdeaTypeDefault: DevIdeaTypeId = view === "prompts" ? "prompt" : "feature";
  const createLifecycleDefault: DevIdeaLifecycleId = view === "prompts" ? "existing" : "planned";
  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <div className="uwe-idea-workspace-head">
        <h2 className="uwe-v2-section-title">{IDEA_WORKSPACE_VIEW_LABELS[view]} ({ideas.length})</h2>
        <div className="uwe-capture-filter-tabs uwe-idea-workspace-tabs">
          {IDEA_WORKSPACE_VIEWS.map((tab) => (<Link key={tab} href={buildIdeasHref({ view: tab, lifecycle: lifecycleFilter, module: moduleFilter })} data-active={view === tab ? "true" : "false"}>{IDEA_WORKSPACE_VIEW_LABELS[tab]}</Link>))}
        </div>
      </div>
      <div className="uwe-idea-workspace-filters">
        <label>Lifecycle<select value={lifecycleFilter ?? ""} onChange={(e) => { window.location.href = buildIdeasHref({ view, lifecycle: e.target.value || null, module: moduleFilter, idea: selectedId }); }} aria-label="Lifecycle filtern"><option value="">Alle</option>{DEV_IDEA_LIFECYCLES.map((l) => (<option key={l} value={l}>{DEV_IDEA_LIFECYCLE_LABELS[l]}</option>))}</select></label>
        {(view === "all" || view === "features") && (<label>Modul<select value={moduleFilter ?? ""} onChange={(e) => { window.location.href = buildIdeasHref({ view, lifecycle: lifecycleFilter, module: e.target.value || null, idea: selectedId }); }} aria-label="Modul filtern"><option value="">Alle</option>{DEV_IDEA_MODULES.map((m) => (<option key={m} value={m}>{DEV_IDEA_MODULE_LABELS[m]}</option>))}</select></label>)}
        {view === "features" && (
          <form action={syncFeatureMatrixAction} className="uwe-idea-matrix-sync-form">
            <WorkspaceContextFields {...workspaceContext} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
              Aus Reifegrad-Matrix synchronisieren
            </button>
          </form>
        )}
      </div>
      <form action={createIdeaAction} className="uwe-brain-create-form">
        <WorkspaceContextFields {...workspaceContext} />
        <label>{view === "prompts" ? "Neuer Prompt (Titel)" : "Neue Idee (Überschrift)"}<input name="title" required placeholder={view === "prompts" ? "z. B. Atlas-Orchestrator Subagent" : "z. B. Dark-Mode für Portal"} /></label>
        <label>Beschreibung<textarea name="body" rows={2} placeholder="Worum geht es?" /></label>
        <IdeaRegistryFields ideaTypeDefault={createIdeaTypeDefault} lifecycleDefault={createLifecycleDefault} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">{view === "prompts" ? "Prompt anlegen" : "Idee anlegen"}</button>
      </form>
      {ideas.length === 0 ? (<p className="uwe-dashboard-muted">{view === "prompts" ? "Noch keine Prompt-Einträge." : view === "features" ? "Keine Features in dieser Ansicht." : "Noch keine Ideen."}</p>) : (
        <ul className="uwe-idea-list">{ideas.map((idea) => (
          <li key={idea.id} className={`uwe-idea-list-item${idea.id === selectedId ? " is-active" : ""}${view === "prompts" && idea.generatedPrompt ? " has-prompt" : ""}`}>
            <button type="button" className="uwe-idea-list-select" aria-pressed={idea.id === selectedId} onClick={() => onSelect(idea.id)}>
              <span className="uwe-idea-list-title">{idea.title}</span>
              <span className="uwe-idea-list-badges">
                {(view === "features" || idea.ideaType === "feature") ? <span className={lifecycleBadgeClass(idea.lifecycle)}>{DEV_IDEA_LIFECYCLE_LABELS[idea.lifecycle]}</span> : null}
                {view === "all" ? <span className="uwe-badge uwe-badge-type">{DEV_IDEA_TYPE_LABELS[idea.ideaType]}</span> : null}
                <span className={statusBadgeClass(idea.status)}>{STATUS_LABELS[idea.status]}</span>
              </span>
              {(view === "features" || view === "all") && (idea.module || idea.maturityLevel) ? <span className="uwe-idea-list-meta">{[moduleLabel(idea.module), maturityLabel(idea.maturityLevel)].filter(Boolean).join(" · ")}</span> : null}
              {view === "prompts" && idea.generatedPrompt ? <span className="uwe-idea-prompt-snippet">{truncatePrompt(idea.generatedPrompt)}</span> : null}
            </button>
            <div className="uwe-idea-list-actions">
              <form action={updateIdeaStatusAction} className="uwe-idea-status-form"><WorkspaceContextFields {...workspaceContext} /><input type="hidden" name="id" value={idea.id} /><select name="status" defaultValue={idea.status} aria-label="Status">{STATUS_ORDER.map((s) => (<option key={s} value={s}>{STATUS_LABELS[s]}</option>))}</select><button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">Setzen</button></form>
              <form action={deleteIdeaAction}><WorkspaceContextFields {...workspaceContext} /><input type="hidden" name="id" value={idea.id} /><button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">Löschen</button></form>
            </div>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
function ChatColumn({
  idea,
  workspaceContext,
  onTranscript,
}: {
  idea: IdeaDto | null;
  workspaceContext: WorkspaceContext;
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
            <WorkspaceContextFields {...workspaceContext} />
            <input type="hidden" name="id" value={idea.id} />
            <label>
              Überschrift
              <input name="title" defaultValue={idea.title} required />
            </label>
            <label>Beschreibung (Fließtext)<textarea name="body" rows={4} defaultValue={idea.body} /></label>
            <IdeaRegistryFields ideaTypeDefault={idea.ideaType} lifecycleDefault={idea.lifecycle} moduleDefault={idea.module ?? ""} maturityDefault={idea.maturityLevel ?? ""} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
              Speichern
            </button>
          </form>
        ) : (
          <>
            <div className="uwe-idea-detail-meta">
              <span className="uwe-badge uwe-badge-type">{DEV_IDEA_TYPE_LABELS[idea.ideaType]}</span>
              <span className={lifecycleBadgeClass(idea.lifecycle)}>{DEV_IDEA_LIFECYCLE_LABELS[idea.lifecycle]}</span>
              {idea.module ? <span className="uwe-dashboard-muted">{moduleLabel(idea.module)}</span> : null}
              {idea.maturityLevel ? <span className="uwe-dashboard-muted">{maturityLabel(idea.maturityLevel)}</span> : null}
            </div>
            {idea.body ? <p className="uwe-idea-detail-body">{idea.body}</p> : null}
          </>
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
  highlightPrompt,
  job,
  agentJobs,
  onPrompt,
  onDispatched,
  onJobUpdate,
  onRefresh,
}: {
  idea: IdeaDto | null;
  highlightPrompt: boolean;
  job: IdeaAgentJobDto | null;
  agentJobs: {
    enabled: boolean;
    cursorConfigured: boolean;
    githubRepo: string | null;
    defaultBranch: string;
    defaultProvider: string;
  };
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

  const cursorDispatchReady =
    agentJobs.enabled && agentJobs.cursorConfigured && Boolean(agentJobs.githubRepo);

  const dispatchDisabled =
    dispatchBusy || draft.trim().length === 0 || !cursorDispatchReady;

  const dispatchTitle = !agentJobs.enabled
    ? "Agent Jobs sind deaktiviert (AGENT_JOBS_ENABLED)."
    : !agentJobs.cursorConfigured
      ? "CURSOR_CLOUD_API_KEY fehlt."
      : !agentJobs.githubRepo
        ? "AGENT_JOBS_GITHUB_REPO fehlt (Format: owner/repo)."
        : undefined;

  return (
    <section className={`uwe-v2-card uwe-v2-card-padded uwe-v2-section${highlightPrompt && draft.trim().length > 0 ? " uwe-idea-prompt-highlight" : ""}`}>
      <h2 className="uwe-v2-section-title">{highlightPrompt ? "Prompt-Bibliothek" : "Aktueller Prompt"}</h2>

      {agentJobs.enabled && (
        <p className="uwe-dashboard-muted uwe-idea-cursor-target">
          Cursor-Ziel:{" "}
          {agentJobs.githubRepo ? (
            <>
              <code>
                github.com/{agentJobs.githubRepo}
              </code>
              {" · Branch "}
              <code>{agentJobs.defaultBranch}</code>
            </>
          ) : (
            <>
              GitHub-Repo nicht konfiguriert
              {" — setze "}
              <code>AGENT_JOBS_GITHUB_REPO=owner/repo</code>
            </>
          )}
          {agentJobs.githubRepo && (
            <>
              {" · "}
              <a
                href="https://cursor.com/docs/integrations/github"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cursor GitHub App
              </a>
              {" muss auf diesem Repo installiert sein."}
            </>
          )}
        </p>
      )}

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

      <textarea className={`uwe-idea-prompt-text${highlightPrompt ? " uwe-idea-prompt-text-library" : ""}`} value={draft}
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
          title={dispatchTitle}
        >
          {dispatchBusy ? "Übergebe…" : "An Cursor übergeben"}
        </button>
      </div>

      {!agentJobs.enabled && (
        <p className="uwe-dashboard-muted">
          Cursor-Übergabe inaktiv — setze <code>AGENT_JOBS_ENABLED=true</code>,
          <code> AGENT_JOBS_GITHUB_REPO=owner/repo</code> und
          <code> CURSOR_CLOUD_API_KEY</code>. Der Prompt kann trotzdem kopiert werden.
        </p>
      )}
      {agentJobs.enabled && !agentJobs.cursorConfigured && (
        <p className="uwe-dashboard-muted">
          Hinweis: <code>CURSOR_CLOUD_API_KEY</code> fehlt — Übergabe ist deaktiviert, Kopieren geht.
        </p>
      )}
      {agentJobs.enabled && agentJobs.cursorConfigured && !agentJobs.githubRepo && (
        <p className="uwe-dashboard-muted">
          Hinweis: <code>AGENT_JOBS_GITHUB_REPO</code> fehlt — Übergabe ist deaktiviert, Kopieren geht.
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
