"use server";

import { requireStudioAiActionAuth } from "@/src/lib/studio-action-auth";
import { AiRouterError, routeAiRequest } from "@uwe/ai-brain";
import {
  createImportJobService,
  createUweRepositoryFromClient,
  prisma,
} from "@uwe/database/server";
import {
  buildCampaignFitChatPrompt,
  sanitizeFitChatTranscript,
  type CampaignFitChatMessage,
} from "@uwe/pdf-campaign-import";
import {
  readCampaignMetadata,
  readPreviewEntities,
  readStoredCampaignContext,
  recordFrom,
} from "@/src/lib/campaign-import-payloads";

/**
 * Einordnungs-Konversation zum PDF-Kampagnenimport: Der Spielleiter bespricht
 * mit der lokalen KI, wie sich die importierte Kampagne in die bestehende Welt
 * einfügt. Läuft ausschließlich über den Maschinenraum (kein Cloud-Fallback); Welt- und
 * Kampagnenbeschreibung werden bewusst nur an die lokale Inferenz angehängt.
 */
export async function campaignFitChatAction(
  jobId: string,
  messages: CampaignFitChatMessage[],
): Promise<{ reply: string; transcript: CampaignFitChatMessage[] }> {
  await requireStudioAiActionAuth();

  const importJobs = createImportJobService(prisma);
  const job = await importJobs.getJob(jobId);
  if (!job) {
    throw new Error("Import-Job nicht gefunden.");
  }
  if (job.sourceType !== "pdf" || job.targetType !== "campaign") {
    throw new Error("Dieser Import-Job ist kein PDF-zu-Kampagne-Import.");
  }

  const transcript = sanitizeFitChatTranscript(messages);
  if (transcript.length === 0 || transcript[transcript.length - 1].role !== "user") {
    throw new Error("Bitte zuerst eine Nachricht schreiben.");
  }

  const context = readCampaignMetadata(job.metadata, job.targetWorldId);
  const repo = createUweRepositoryFromClient(prisma);
  const world = await repo.getWorldBySlug(context.worldSlug);
  const campaign = await repo.getCampaignBySlug(context.worldSlug, context.campaignSlug);
  if (!world || !campaign || campaign.id !== context.campaignId) {
    throw new Error("Die Zielkampagne gehört nicht mehr zur ausgewählten Welt.");
  }

  const entities = readPreviewEntities(job.previewPayload) ?? [];
  const useMock = process.env.NODE_ENV !== "production" && process.env.AI_USE_MOCK === "true";
  const prompt = buildCampaignFitChatPrompt(
    {
      worldName: world.name,
      worldDescription: world.description,
      campaignName: campaign.name,
      campaignDescription: campaign.description,
      campaignContext: readStoredCampaignContext(job.previewPayload),
      entities,
    },
    transcript,
  );

  let replyText: string;
  try {
    const routed = await routeAiRequest(
      { repo, prisma },
      {
        providerMode: "local_engine",
        contextMode: "general_chat",
        taskType: "create_knowledge_text",
        userPrompt: prompt,
        useMock,
        maxTokens: 2_048,
      },
    );
    replyText = routed.result.text.trim();
  } catch (error) {
    if (error instanceof AiRouterError) {
      throw new Error(
        "Der lokale Maschinenraum ist offline — die Einordnungs-Konversation kann nicht in die Cloud ausweichen.",
      );
    }
    throw error;
  }
  if (!replyText) {
    throw new Error("Lokale KI hat keine Antwort geliefert.");
  }

  const nextTranscript = sanitizeFitChatTranscript([
    ...transcript,
    { role: "assistant", content: replyText },
  ]);

  // Verlauf am Job persistieren, damit er einen Seiten-Reload überlebt.
  const existingMetadata = recordFrom(job.metadata) ?? {};
  await importJobs.updateJob(jobId, {
    metadata: { ...existingMetadata, fitChat: nextTranscript },
  });

  return { reply: replyText, transcript: nextTranscript };
}
