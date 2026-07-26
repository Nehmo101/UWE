/**
 * View types for the Brain KI-Assistent.
 *
 * This module is import-safe for client components: it contains only types and
 * plain constants — no Prisma client, no `node:` builtins, no provider code.
 * Client components import it via `@uwe/brain-assistant/types`.
 */

export type AssistantRole = "user" | "assistant";

export type AssistantContextMode = "plain" | "life_brain";

export type AssistantAttachmentKind = "image" | "document" | "audio";

export const ASSISTANT_CONTEXT_MODES: readonly AssistantContextMode[] = [
  "plain",
  "life_brain",
] as const;

export const ASSISTANT_CONTEXT_MODE_LABELS: Record<AssistantContextMode, string> = {
  plain: "Reiner Chat",
  life_brain: "Mit Life-Brain-Wissen",
};

/** How many past messages are replayed into the flattened prompt. */
export const ASSISTANT_MAX_HISTORY = 40;

/** Per-attachment character budget inside the prompt. */
export const ASSISTANT_ATTACHMENT_TEXT_LIMIT = 6_000;

/** Combined character budget for all attachment blocks of one turn. */
export const ASSISTANT_ATTACHMENT_TOTAL_LIMIT = 16_000;

/** Character budget for the retrieved Life-Brain context block. */
export const ASSISTANT_RAG_CONTEXT_LIMIT = 8_000;

/**
 * Namespace used as the "world" segment of an attachment storage key. Mirrors
 * Studio's `_scan` convention so Brain files stay in their own folder under the
 * uploads root.
 */
export const ASSISTANT_UPLOAD_NAMESPACE = "_brain-assistant";

export interface AssistantAttachmentView {
  id: string;
  kind: AssistantAttachmentKind;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  /** Vision description, extracted document text or transcript — null while pending. */
  extractedText: string | null;
  createdAt: string;
}

export interface AssistantMessageView {
  id: string;
  role: AssistantRole;
  content: string;
  model: string | null;
  /** "llm" or "vision" — which connector path answered this turn. */
  route: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  attachments: AssistantAttachmentView[];
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  contextMode: AssistantContextMode;
  modelLabel: string | null;
  updatedAt: string;
  messageCount: number;
}

export interface AssistantConversationView extends AssistantConversationSummary {
  connectorId: string | null;
  modelId: string | null;
  messages: AssistantMessageView[];
}

/** A model the Command Center transferred, flattened for the picker. */
export interface AssistantModelOption {
  connectorId: string;
  connectorName: string;
  modelId: string;
  /** Technical model name handed to the connector at inference time. */
  name: string;
  label: string;
  description: string | null;
  bestFor: string[];
  modelType: string | null;
  /** False when the connector is currently offline. */
  available: boolean;
}

/** The AI assigned in the Brain ("hinterlegte KI"). */
export interface AssistantProfileView {
  chat: AssistantModelRef | null;
  vision: AssistantModelRef | null;
  sttModelName: string | null;
  systemPrompt: string;
  defaultContextMode: AssistantContextMode;
}

export interface AssistantModelRef {
  connectorId: string;
  modelId: string;
  /** Snapshot of the display name — survives the connector going offline. */
  label: string;
}

/** What the client needs to decide which input affordances to show. */
export interface AssistantCapabilityView {
  aiEnabled: boolean;
  localAiReady: boolean;
  visionAvailable: boolean;
  /** True when a connector advertises `stt_local` (local dictation possible). */
  sttAvailable: boolean;
}

export type AssistantTurnResult =
  | { kind: "completed"; message: AssistantMessageView }
  | { kind: "unavailable"; message: string };
