"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEV_IDEA_LIFECYCLE_LABELS, DEV_IDEA_LIFECYCLES, DEV_IDEA_MATURITY_LABELS, DEV_IDEA_MATURITY_LEVELS,
  DEV_IDEA_MODULE_LABELS, DEV_IDEA_MODULES, DEV_IDEA_TYPE_LABELS, DEV_IDEA_TYPES,
  IDEA_WORKSPACE_VIEW_LABELS, IDEA_WORKSPACE_VIEWS,
  type DevIdeaLifecycleId, type DevIdeaMaturityLevelId, type DevIdeaModuleId, type DevIdeaTypeId, type IdeaWorkspaceView,
} from "@uwe/database/dev-idea-constants";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  Alert,
  Badge,
  type BadgeProps,
  badgeVariants,
  Button,
  Card,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
import { IdeaAttachments, type IdeaAttachment } from "./IdeaAttachments";
import { IdeaClaudeHandover } from "./IdeaClaudeHandover";
import {
  createIdeaAction,
  deleteIdeaAction,
  convertIdeaToCaptureAction,
  syncFeatureMatrixAction,
  updateIdeaAction,
  updateIdeaStatusAction,
} from "../ideas-actions";

export type IdeaStatus = "in_planning" | "implemented" | "rejected";
export type ProviderMode = "auto" | "local_engine" | "cloud";

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
  attachments: IdeaAttachment[];
  generatedPrompt: string | null;
  updatedAt: string;
}

interface IdeaWorkspaceClientProps {
  ideas: IdeaDto[];
  initialSelectedId: string | null;
  initialView: IdeaWorkspaceView;
  initialLifecycleFilter: string | null;
  initialModuleFilter: string | null;
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
  local_engine: "Lokal (Maschinenraum)",
  cloud: "Cloud",
};

/** Native select styling used where Kit-Select (Radix) cannot be used — see TODO(design-kit) comments below. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

function statusBadgeVariant(status: IdeaStatus): BadgeVariant {
  switch (status) {
    case "implemented":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "warning";
  }
}

function lifecycleBadgeVariant(lifecycle: DevIdeaLifecycleId): BadgeVariant {
  switch (lifecycle) {
    case "existing":
      return "success";
    case "broken":
      return "danger";
    // TODO(design-kit): Kit-Badge hat keine eigene "draft"-Tonalität — "secondary" hält
    // "deprecated" von "planned" (warning) unterscheidbar.
    case "deprecated":
      return "secondary";
    default:
      return "warning";
  }
}
function moduleLabel(module: string | null): string | null { if (!module) return null; return DEV_IDEA_MODULE_LABELS[module as DevIdeaModuleId] ?? module; }
function maturityLabel(maturity: string | null): string | null { if (!maturity) return null; return DEV_IDEA_MATURITY_LABELS[maturity as DevIdeaMaturityLevelId] ?? maturity; }
function truncatePrompt(text: string, max = 120): string { const trimmed = text.trim(); return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`; }
function buildIdeasHref(options: { view: IdeaWorkspaceView; lifecycle?: string | null; module?: string | null; idea?: string | null; }): string { const params = new URLSearchParams(); if (options.view !== "all") params.set("view", options.view); if (options.lifecycle) params.set("lifecycle", options.lifecycle); if (options.module) params.set("module", options.module); if (options.idea) params.set("idea", options.idea); const q = params.toString(); return q ? `/ideas?${q}` : "/ideas"; }

export function IdeaWorkspaceClient({
  ideas: initialIdeas,
  initialSelectedId,
  initialView,
  initialLifecycleFilter,
  initialModuleFilter,
}: IdeaWorkspaceClientProps) {
  const [ideas, setIdeas] = useState<IdeaDto[]>(initialIdeas);
  const view = initialView;
  const lifecycleFilter = initialLifecycleFilter;
  const moduleFilter = initialModuleFilter;
  const workspaceContext: WorkspaceContext = { view, lifecycle: lifecycleFilter, module: moduleFilter };

  useEffect(() => { setIdeas(initialIdeas); }, [initialIdeas]);

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
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3" data-columns="3">
      <IdeaListColumn ideas={filteredIdeas} selectedId={selected?.id ?? null} onSelect={setSelectedId} view={view} lifecycleFilter={lifecycleFilter} moduleFilter={moduleFilter} workspaceContext={workspaceContext} />
      <ChatColumn key={`chat-${selected?.id ?? "none"}`} idea={selected} workspaceContext={workspaceContext} onTranscript={(transcript) => selected && patchIdea(selected.id, { transcript })} onAttachments={(attachments) => selected && patchIdea(selected.id, { attachments })} />
      <PromptColumn key={`prompt-${selected?.id ?? "none"}`} idea={selected} highlightPrompt={view === "prompts"} onPrompt={(p) => selected && patchIdea(selected.id, { generatedPrompt: p })} />
    </div>
  );
}

function IdeaRegistryFields({ ideaTypeDefault = "feature", lifecycleDefault = "planned", moduleDefault = "", maturityDefault = "" }: { ideaTypeDefault?: DevIdeaTypeId; lifecycleDefault?: DevIdeaLifecycleId; moduleDefault?: string; maturityDefault?: string; }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Typ</Label>
        <Select name="ideaType" defaultValue={ideaTypeDefault}>
          <SelectTrigger aria-label="Typ"><SelectValue /></SelectTrigger>
          <SelectContent>{DEV_IDEA_TYPES.map((type) => (<SelectItem key={type} value={type}>{DEV_IDEA_TYPE_LABELS[type]}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Lifecycle</Label>
        <Select name="lifecycle" defaultValue={lifecycleDefault}>
          <SelectTrigger aria-label="Lifecycle"><SelectValue /></SelectTrigger>
          <SelectContent>{DEV_IDEA_LIFECYCLES.map((l) => (<SelectItem key={l} value={l}>{DEV_IDEA_LIFECYCLE_LABELS[l]}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      {/* TODO(design-kit): Modul/Reifegrad bleiben natives Select — Kit-Select (Radix) erlaubt keinen
          leeren value="" für "— keins —"/"— keiner —"; aria-label statt Label-Kopplung, da dieses
          Feld über mehrere gleichzeitig gerenderte Formulare (Anlegen + Bearbeiten) wiederverwendet wird. */}
      <div className="flex flex-col gap-1.5">
        <Label>Modul</Label>
        <select name="module" defaultValue={moduleDefault} aria-label="Modul" className={NATIVE_SELECT_CLASS}>
          <option value="">— keins —</option>
          {DEV_IDEA_MODULES.map((m) => (<option key={m} value={m}>{DEV_IDEA_MODULE_LABELS[m]}</option>))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Reifegrad</Label>
        <select name="maturityLevel" defaultValue={maturityDefault} aria-label="Reifegrad" className={NATIVE_SELECT_CLASS}>
          <option value="">— keiner —</option>
          {DEV_IDEA_MATURITY_LEVELS.map((l) => (<option key={l} value={l}>{DEV_IDEA_MATURITY_LABELS[l]}</option>))}
        </select>
      </div>
    </>
  );
}

function WorkspaceContextFields({ view, lifecycle, module }: WorkspaceContext) {
  return (<><input type="hidden" name="view" value={view} />{lifecycle ? <input type="hidden" name="lifecycle" value={lifecycle} /> : null}{module ? <input type="hidden" name="module" value={module} /> : null}</>);
}

function IdeaListColumn({ ideas, selectedId, onSelect, view, lifecycleFilter, moduleFilter, workspaceContext }: { ideas: IdeaDto[]; selectedId: string | null; onSelect: (id: string) => void; view: IdeaWorkspaceView; lifecycleFilter: string | null; moduleFilter: string | null; workspaceContext: WorkspaceContext; }) {
  const createIdeaTypeDefault: DevIdeaTypeId = view === "prompts" ? "prompt" : "feature";
  const createLifecycleDefault: DevIdeaLifecycleId = view === "prompts" ? "existing" : "planned";
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{IDEA_WORKSPACE_VIEW_LABELS[view]} ({ideas.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {IDEA_WORKSPACE_VIEWS.map((tab) => (
            <Link key={tab} href={buildIdeasHref({ view: tab, lifecycle: lifecycleFilter, module: moduleFilter })} data-active={view === tab ? "true" : "false"}
              className={cn(badgeVariants({ variant: view === tab ? "accent" : "default" }), "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
              {IDEA_WORKSPACE_VIEW_LABELS[tab]}
            </Link>
          ))}
        </div>
      </div>
      {/* TODO(design-kit): Lifecycle-/Modul-Filter bleiben natives Select — controlliert
          (value+onChange, navigiert per window.location.href), daher kein Kit-Select. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-filter-lifecycle" className="text-xs">Lifecycle</Label>
          <select id="idea-filter-lifecycle" value={lifecycleFilter ?? ""} aria-label="Lifecycle filtern" className={NATIVE_SELECT_CLASS}
            onChange={(e) => { window.location.href = buildIdeasHref({ view, lifecycle: e.target.value || null, module: moduleFilter, idea: selectedId }); }}>
            <option value="">Alle</option>
            {DEV_IDEA_LIFECYCLES.map((l) => (<option key={l} value={l}>{DEV_IDEA_LIFECYCLE_LABELS[l]}</option>))}
          </select>
        </div>
        {(view === "all" || view === "features") && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-filter-module" className="text-xs">Modul</Label>
            <select id="idea-filter-module" value={moduleFilter ?? ""} aria-label="Modul filtern" className={NATIVE_SELECT_CLASS}
              onChange={(e) => { window.location.href = buildIdeasHref({ view, lifecycle: lifecycleFilter, module: e.target.value || null, idea: selectedId }); }}>
              <option value="">Alle</option>
              {DEV_IDEA_MODULES.map((m) => (<option key={m} value={m}>{DEV_IDEA_MODULE_LABELS[m]}</option>))}
            </select>
          </div>
        )}
        {view === "features" && (
          <form action={syncFeatureMatrixAction}>
            <WorkspaceContextFields {...workspaceContext} />
            <Button type="submit" variant="secondary" size="sm">Aus Reifegrad-Matrix synchronisieren</Button>
          </form>
        )}
      </div>
      <form action={createIdeaAction} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
        <WorkspaceContextFields {...workspaceContext} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-create-title">{view === "prompts" ? "Neuer Prompt (Titel)" : "Neue Idee (Überschrift)"}</Label>
          <Input id="idea-create-title" name="title" required placeholder={view === "prompts" ? "z. B. Kartenzeichen-Subagent" : "z. B. Dark-Mode für Portal"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-create-body">Beschreibung</Label>
          <Textarea id="idea-create-body" name="body" rows={2} placeholder="Worum geht es?" />
        </div>
        <IdeaRegistryFields ideaTypeDefault={createIdeaTypeDefault} lifecycleDefault={createLifecycleDefault} />
        <Button type="submit" size="sm">{view === "prompts" ? "Prompt anlegen" : "Idee anlegen"}</Button>
      </form>
      {ideas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{view === "prompts" ? "Noch keine Prompt-Einträge." : view === "features" ? "Keine Features in dieser Ansicht." : "Noch keine Ideen."}</p>
      ) : (
        <ul className="flex flex-col gap-2">{ideas.map((idea) => (
          <li key={idea.id} className={cn("rounded-[var(--radius)] border border-border p-2.5", view === "prompts" && idea.generatedPrompt && "border-primary/45", idea.id === selectedId && "border-primary ring-1 ring-primary")}>
            <button type="button" className="flex w-full flex-col items-start gap-1.5 text-left" aria-pressed={idea.id === selectedId} onClick={() => onSelect(idea.id)}>
              <span className="font-semibold">{idea.title}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {(view === "features" || idea.ideaType === "feature") ? <Badge variant={lifecycleBadgeVariant(idea.lifecycle)}>{DEV_IDEA_LIFECYCLE_LABELS[idea.lifecycle]}</Badge> : null}
                {view === "all" ? <Badge>{DEV_IDEA_TYPE_LABELS[idea.ideaType]}</Badge> : null}
                <Badge variant={statusBadgeVariant(idea.status)}>{STATUS_LABELS[idea.status]}</Badge>
              </span>
              {(view === "features" || view === "all") && (idea.module || idea.maturityLevel) ? <span className="text-xs text-muted-foreground">{[moduleLabel(idea.module), maturityLabel(idea.maturityLevel)].filter(Boolean).join(" · ")}</span> : null}
              {view === "prompts" && idea.generatedPrompt ? (
                <span className="block w-full whitespace-pre-wrap rounded-r-[var(--radius)] border-l-2 border-primary bg-primary/10 px-2 py-1 text-xs">{truncatePrompt(idea.generatedPrompt)}</span>
              ) : null}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <form action={updateIdeaStatusAction} className="flex items-center gap-1.5">
                <WorkspaceContextFields {...workspaceContext} />
                <input type="hidden" name="id" value={idea.id} />
                <Select name="status" defaultValue={idea.status}>
                  <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_ORDER.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}</SelectContent>
                </Select>
                <Button type="submit" variant="ghost" size="sm">Setzen</Button>
              </form>
              <form action={deleteIdeaAction}>
                <WorkspaceContextFields {...workspaceContext} />
                <input type="hidden" name="id" value={idea.id} />
                <Button type="submit" variant="ghost" size="sm">Löschen</Button>
              </form>
            </div>
          </li>
        ))}</ul>
      )}
    </Card>
  );
}
function ChatColumn({
  idea,
  workspaceContext,
  onTranscript,
  onAttachments,
}: {
  idea: IdeaDto | null;
  workspaceContext: WorkspaceContext;
  onTranscript: (transcript: IdeaChatMessage[]) => void;
  onAttachments: (attachments: IdeaAttachment[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [providerMode, setProviderMode] = useState<ProviderMode>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (!idea) {
    return (
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-base font-semibold tracking-tight">KI-Chat</h2>
        <p className="text-sm text-muted-foreground">Wähle links eine Idee aus, um sie zu besprechen.</p>
      </Card>
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
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-base font-semibold tracking-tight">KI-Chat</h2>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{idea.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <form action={convertIdeaToCaptureAction}>
              <WorkspaceContextFields {...workspaceContext} />
              <input type="hidden" name="id" value={idea.id} />
              <Button type="submit" variant="secondary" size="sm">In Capture umwandeln</Button>
            </form>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>{editing ? "Schließen" : "Bearbeiten"}</Button>
          </div>
        </div>
        {editing ? (
          <form action={updateIdeaAction} className="flex flex-col gap-3">
            <WorkspaceContextFields {...workspaceContext} />
            <input type="hidden" name="id" value={idea.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idea-edit-title">Überschrift</Label>
              <Input id="idea-edit-title" name="title" defaultValue={idea.title} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idea-edit-body">Beschreibung (Fließtext)</Label>
              <Textarea id="idea-edit-body" name="body" rows={4} defaultValue={idea.body} />
            </div>
            <IdeaRegistryFields ideaTypeDefault={idea.ideaType} lifecycleDefault={idea.lifecycle} moduleDefault={idea.module ?? ""} maturityDefault={idea.maturityLevel ?? ""} />
            <Button type="submit" variant="secondary" size="sm">Speichern</Button>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{DEV_IDEA_TYPE_LABELS[idea.ideaType]}</Badge>
              <Badge variant={lifecycleBadgeVariant(idea.lifecycle)}>{DEV_IDEA_LIFECYCLE_LABELS[idea.lifecycle]}</Badge>
              {idea.module ? <span className="text-sm text-muted-foreground">{moduleLabel(idea.module)}</span> : null}
              {idea.maturityLevel ? <span className="text-sm text-muted-foreground">{maturityLabel(idea.maturityLevel)}</span> : null}
            </div>
            {idea.body ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{idea.body}</p> : null}
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Anhänge (Bilder)</h3>
        <IdeaAttachments ideaId={idea.id} attachments={idea.attachments} onChange={onAttachments} />
      </div>
      <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto" aria-label="Chatverlauf">
        {idea.transcript.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch kein Verlauf. Übernimm die Idee als Fließtext und lass die KI nachfragen.</p>
        ) : (
          idea.transcript.map((msg, index) => (
            <div key={`${msg.role}-${index}`} className={cn("rounded-[var(--radius)] p-2.5", msg.role === "user" ? "bg-primary/15" : "bg-primary/10")}>
              <span className="mb-0.5 block text-xs font-semibold opacity-70">
                {msg.role === "user" ? "Du" : "KI"}
                {msg.via ? ` · ${msg.via === "local_engine" ? "Maschinenraum" : "Cloud"}` : ""}
              </span>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>
          ))
        )}
      </div>
      {/* TODO(design-kit): controlliertes Select (value+onChange) — bleibt nativ mit Tailwind-Styling. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chat-provider" className="text-xs">KI-Quelle</Label>
          <select id="chat-provider" value={providerMode} onChange={(event) => setProviderMode(event.target.value as ProviderMode)} disabled={busy} className={NATIVE_SELECT_CLASS}>
            {(Object.keys(PROVIDER_LABELS) as ProviderMode[]).map((mode) => (<option key={mode} value={mode}>{PROVIDER_LABELS[mode]}</option>))}
          </select>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMessage(idea.body || idea.title)} disabled={busy}>Idee als Fließtext übernehmen</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chat-message">Nachricht an die KI</Label>
        <Textarea id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Frage stellen, Idee einfügen oder Anweisung geben…" disabled={busy} />
      </div>
      {info && <Alert tone="info">{info}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="button" onClick={() => void send()} disabled={busy || message.trim().length === 0}>{busy ? "KI antwortet…" : "Senden"}</Button>
    </Card>
  );
}

function PromptColumn({
  idea,
  highlightPrompt,
  onPrompt,
}: {
  idea: IdeaDto | null;
  highlightPrompt: boolean;
  onPrompt: (prompt: string) => void;
}) {
  const [draft, setDraft] = useState(idea?.generatedPrompt ?? "");
  const [providerMode, setProviderMode] = useState<ProviderMode>("auto");
  const [genBusy, setGenBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(idea?.generatedPrompt ?? "");
  }, [idea?.id, idea?.generatedPrompt]);

  if (!idea) {
    return (
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-base font-semibold tracking-tight">Aktueller Prompt</h2>
        <p className="text-sm text-muted-foreground">Wähle eine Idee, um einen Prompt zu erstellen.</p>
      </Card>
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

  async function savePrompt() {
    if (saveBusy || !idea) return;
    setSaveBusy(true);
    setError(null);
    try {
      const res = await fetch(studioApiUrl(`/api/ideas/${idea.id}/prompt`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedPrompt: draft }),
      });
      const data = (await res.json()) as { generatedPrompt?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Prompt konnte nicht gespeichert werden.");
      }
      const prompt = data.generatedPrompt ?? draft;
      setDraft(prompt);
      onPrompt(prompt);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Prompt konnte nicht gespeichert werden.");
    } finally {
      setSaveBusy(false);
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

  return (
    <Card className={cn("flex flex-col gap-4 p-4", highlightPrompt && draft.trim().length > 0 && "ring-1 ring-inset ring-primary/40")}>
      <h2 className="text-base font-semibold tracking-tight">{highlightPrompt ? "Prompt-Bibliothek" : "Aktueller Prompt"}</h2>
      {/* TODO(design-kit): controlliertes Select (value+onChange) — bleibt nativ mit Tailwind-Styling. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt-provider" className="text-xs">KI-Quelle</Label>
          <select id="prompt-provider" value={providerMode} onChange={(event) => setProviderMode(event.target.value as ProviderMode)} disabled={genBusy} className={NATIVE_SELECT_CLASS}>
            {(Object.keys(PROVIDER_LABELS) as ProviderMode[]).map((mode) => (<option key={mode} value={mode}>{PROVIDER_LABELS[mode]}</option>))}
          </select>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void generate()} disabled={genBusy}>{genBusy ? "Erstelle…" : "Prompt erstellen"}</Button>
      </div>
      <Textarea
        className={cn("font-mono text-sm", highlightPrompt && "border-primary/40 bg-primary/5")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={10}
        placeholder="Hier erscheint der aus dem KI-Chat erzeugte Entwicklungs-Prompt. Du kannst ihn anpassen, bevor du ihn kopierst."
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => void savePrompt()} disabled={saveBusy || draft.trim().length === 0}>{saveBusy ? "Speichere…" : "Prompt speichern"}</Button>
        <Button type="button" variant="ghost" onClick={() => void copy()} disabled={draft.trim().length === 0}>{copied ? "Kopiert!" : "Kopieren"}</Button>
      </div>
      <IdeaClaudeHandover title={idea.title} body={idea.body} prompt={draft} attachments={idea.attachments} />
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}
