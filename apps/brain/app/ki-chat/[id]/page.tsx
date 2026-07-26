import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createBrainAssistantService,
  listAssignableModels,
  resolveAssistantModel,
} from "@uwe/brain-assistant";
import { getBrainOwner } from "@/src/lib/page-owner";
import { loadAssistantCapabilities } from "@/src/lib/assistant-capabilities";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { AssistantStatus } from "../AssistantStatus";
import { ConversationSettings } from "./ConversationSettings";
import { AssistantChat } from "../AssistantChat";

export const dynamic = "force-dynamic";

export default async function BrainKiChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/ki-chat" title="KI-Chat">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { id } = await params;
  const service = createBrainAssistantService(brainPrisma);
  const conversation = await service.getConversation(id);
  if (!conversation) {
    notFound();
  }

  const [profile, models, capabilities] = await Promise.all([
    service.getProfile(),
    listAssignableModels(prisma),
    loadAssistantCapabilities(prisma),
  ]);

  const chatModel = await resolveAssistantModel(prisma, {
    conversationRef:
      conversation.connectorId && conversation.modelId
        ? {
            connectorId: conversation.connectorId,
            modelId: conversation.modelId,
            label: conversation.modelLabel ?? conversation.modelId,
          }
        : null,
    profileRef: profile.chat,
    slot: "chat",
  });

  return (
    <BrainShell
      active="/ki-chat"
      title={conversation.title}
      eyebrow="Owner-Bereich · privat"
      actions={<Link className="brain-btn-ghost brain-btn-sm" href="/ki-chat">Alle Unterhaltungen</Link>}
    >
      <AssistantStatus capabilities={capabilities} />

      <AssistantChat
        conversationId={conversation.id}
        initialMessages={conversation.messages}
        capabilities={capabilities}
        modelLabel={chatModel.label}
        modelAvailable={chatModel.available}
      />

      <ConversationSettings conversation={conversation} models={models.chat} />
    </BrainShell>
  );
}
