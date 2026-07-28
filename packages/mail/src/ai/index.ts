/**
 * Mail-KI — Priorisierung, Zusammenfassung, Antwortentwurf, Mail-Chat.
 *
 * Lag als vier Dateien in `apps/studio/src/lib/`, obwohl nichts davon Studio
 * kannte: alles läuft über `@uwe/ai-brain` und `@uwe/database`. Mit dem Umzug
 * des Mail-Centers nach Brain brauchten es zwei Apps — und damit war der Ort
 * ohnehin falsch. Jede Anfrage läuft im Gateway-Kontext `mail`, also lokal.
 */
export {
  generateMailPriority,
  generateMailSummary,
  generateMailReplyDraft,
  parseMailPriorityResponse,
  type MailAiPriorityScore,
  type MailAiUser,
} from "./mail-ai";

export {
  executeMailChat,
  type MailChatMessage,
  type MailChatRequest,
  type MailChatResult,
} from "./mail-chat";

export { buildMailChatPrompt } from "./chat-prompt";
