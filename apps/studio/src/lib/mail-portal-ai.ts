import { mailBodyForProcessing } from "@uwe/mail/portal-types";
import { runInferenceTestPrompt } from "@uwe/ai-brain";
import type { MailReplyTone } from "@uwe/mail/portal-types";

export async function generateMailSummary(input: {
  subject: string;
  fromAddress: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): Promise<{ text: string; provider: string; model: string }> {
  const body = mailBodyForProcessing(input.bodyText, input.bodyHtml).slice(0, 4000);

  try {
    const ai = await runInferenceTestPrompt({
      prompt: `Fasse diese E-Mail in 2-3 Sätzen zusammen (Deutsch). Betreff: ${input.subject}\nVon: ${input.fromAddress}\n\n${body}`,
      useMock: process.env.AI_USE_MOCK === "true",
    });
    if (ai.ok && ai.text?.trim()) {
      return { text: ai.text.trim(), provider: ai.provider, model: ai.model };
    }
  } catch {
    // fallback below
  }

  return {
    text: body.slice(0, 280) + (body.length > 280 ? "…" : ""),
    provider: "rules",
    model: "truncate-v1",
  };
}

export async function generateMailReplyDraft(input: {
  subject: string;
  fromAddress: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  tone: MailReplyTone;
}): Promise<{ text: string; provider: string; model: string }> {
  const body = mailBodyForProcessing(input.bodyText, input.bodyHtml).slice(0, 3000);
  const toneHint =
    input.tone === "short"
      ? "Sehr kurz."
      : input.tone === "friendly"
        ? "Freundlich und warm."
        : input.tone === "direct"
          ? "Direkt und sachlich."
          : "Professionell und höflich.";

  try {
    const ai = await runInferenceTestPrompt({
      prompt: `Schreibe einen Antwortentwurf (${toneHint}) auf diese E-Mail. Nur den Antworttext, keine Metadaten.\nBetreff: ${input.subject}\nVon: ${input.fromAddress}\n\n${body}`,
      useMock: process.env.AI_USE_MOCK === "true",
    });
    if (ai.ok && ai.text?.trim()) {
      return { text: ai.text.trim(), provider: ai.provider, model: ai.model };
    }
  } catch {
    // fallback below
  }

  return {
    text: `Hallo,\n\nvielen Dank für Ihre Nachricht zu „${input.subject}“.\n\n[Ihre Antwort hier]\n\nFreundliche Grüße`,
    provider: "template",
    model: "template-v1",
  };
}
