import Link from "next/link";
import { prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { createBrainAssistantService, listAssignableModels } from "@uwe/brain-assistant";
import { getBrainOwner } from "@/src/lib/page-owner";
import { loadAssistantCapabilities } from "@/src/lib/assistant-capabilities";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { AssistantModelPanel } from "./AssistantModelPanel";
import { ConversationList } from "./ConversationList";
import { AssistantStatus } from "./AssistantStatus";

export const dynamic = "force-dynamic";

export default async function BrainKiChatPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/ki-chat" title="KI-Chat">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createBrainAssistantService(brainPrisma);
  const [conversations, profile, models, capabilities] = await Promise.all([
    service.listConversations(),
    service.getProfile(),
    listAssignableModels(prisma),
    loadAssistantCapabilities(prisma),
  ]);

  return (
    <BrainShell
      active="/ki-chat"
      title="KI-Chat"
      eyebrow="Owner-Bereich · privat"
      lede="Chatte mit der KI, die du vom Command Center übertragen hast — Text, Bilder, Dokumente und Diktat. Läuft ausschließlich lokal, niemals in der Cloud."
    >
      <AssistantStatus capabilities={capabilities} />

      <section className="brain-section">
        <h2>Hinterlegte KI</h2>
        <AssistantModelPanel profile={profile} models={models} />
      </section>

      <section className="brain-section">
        <div className="brain-head">
          <h2>Unterhaltungen</h2>
        </div>
        <ConversationList conversations={conversations} />
        {conversations.length > 0 && (
          <p className="brain-muted">
            <Link href={`/ki-chat/${conversations[0].id}`}>Zuletzt genutzte Unterhaltung öffnen</Link>
          </p>
        )}
      </section>
    </BrainShell>
  );
}
