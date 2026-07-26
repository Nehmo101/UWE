/**
 * `@uwe/brain-assistant` — the owner-private KI-Chatbot behind the Brain's
 * assistant panel: persisted conversations, a hinterlegte (assigned) Connector
 * model, image analysis, document intake and local dictation.
 *
 * Everything routes through the local Connector/RTX path. There is no cloud
 * fallback anywhere in this package.
 */

export * from "./assistant-types";

export {
  ASSISTANT_DEFAULT_SYSTEM_PROMPT,
  ASSISTANT_VISION_DESCRIBE_PROMPT,
  buildAssistantPrompt,
  truncateForPrompt,
  type BuildAssistantPromptInput,
  type PromptAttachmentBlock,
  type PromptHistoryMessage,
} from "./chat-prompt";

export {
  BrainAssistantService,
  createBrainAssistantService,
  deriveConversationTitle,
  type AppendMessageInput,
} from "./conversation-service";

export {
  listAssignableModels,
  resolveAssistantModel,
  type ResolvedAssistantModel,
} from "./model-service";

export {
  assistantUploadPolicy,
  attachmentKindForFileKind,
  extractAttachmentText,
  storeAssistantAttachment,
  UploadValidationError,
  type ExtractAttachmentTextResult,
  type StoredAssistantAttachment,
} from "./attachments";

export { loadAssistantRagContext } from "./rag-context";

export {
  runAssistantTurn,
  type AssistantRunnerDeps,
  type RunAssistantTurnInput,
} from "./chat-runner";

export {
  transcribeAssistantAudio,
  ASSISTANT_MAX_AUDIO_BYTES,
  type TranscribeInput,
  type TranscribeResult,
} from "./transcription";
