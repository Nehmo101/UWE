import {
  executeAiGatewayRequest,
  isRtxReadinessReady,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createUweRepository,
  getSystemSettings,
  prisma,
} from "@uwe/database/server";
import { mailBodyForProcessing } from "@uwe/mail/portal-types";
import { buildMailChatPrompt, type MailChatMessage } from "./chat-prompt";

export type { MailChatMessage };

export interface MailChatRequest {
  messageId: string;
  subject: string;
  fromAddress: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  messages: MailChatMessage[];
  useMock?: boolean;
}

export type MailChatResult =
  | { kind: "completed"; text: string; provider: string; model: string; routedVia: string }
  | { kind: "unavailable"; message: string };

export async function executeMailChat(
  body: MailChatRequest,
  user: { userId: string },
): Promise<MailChatResult> {
  const transcript = body.messages
    .map((entry) => ({ role: entry.role, content: entry.content.trim() }))
    .filter((entry) => entry.content.length > 0);

  const lastUser = [...transcript].reverse().find((entry) => entry.role === "user");
  if (!lastUser) {
    throw new Error("Mindestens eine Nutzer-Nachricht ist erforderlich.");
  }

  const mailBody = mailBodyForProcessing(body.bodyText, body.bodyHtml).slice(0, 6000);
  const userPrompt = buildMailChatPrompt({
    subject: body.subject,
    fromAddress: body.fromAddress,
    body: mailBody,
    messages: transcript,
  });

  const systemSettings = await getSystemSettings();
  if (!systemSettings.ai.enabled) {
    throw new Error("KI ist deaktiviert.");
  }

  const rtxReady = await isRtxReadinessReady({ useMock: body.useMock, prisma });
  if (!rtxReady) {
    return {
      kind: "unavailable",
      message:
        "Lokale RTX-Inference ist offline. Der Mail-Assistent nutzt niemals Cloud-KI — bitte RTX Connector starten.",
    };
  }

  const routed = await executeAiGatewayRequest(
    {
      repo: createUweRepository(),
      brainStore: createBrainStoreService(),
    },
    {
      user,
      providerMode: "local_rtx",
      contextMode: "mail",
      taskType: "answer_mail_question",
      userPrompt,
      useMock: body.useMock,
      feature: "AI_SUMMARY_USE",
    },
  );

  return {
    kind: "completed",
    text: routed.result.text,
    provider: routed.result.provider,
    model: routed.result.model,
    routedVia: routed.route,
  };
}
