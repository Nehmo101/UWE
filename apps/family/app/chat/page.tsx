import { createFamilyService } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { FamilyChatView } from "@/src/components/FamilyChatView";

/** Family-Chat (G12) — gemeinsam, alles sichtbar für alle mit dem Häkchen. */

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ c?: string }>;
}

export default async function FamilyChatPage({ searchParams }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/chat" title="Family-Chat">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { c } = await searchParams;
  const service = createFamilyService(familyPrisma);
  const conversations = await service.listConversations(user.id, "shared");
  const active = c ? await service.getConversation(c, user.id) : conversations[0] ?? null;
  const [messages, facts] = await Promise.all([
    active ? service.listMessages(active.id, user.id) : Promise.resolve([]),
    service.listFacts(user.id, "shared"),
  ]);

  return (
    <FamilyShell
      active="/chat"
      title="Family-Chat"
      eyebrow="Gemeinsam"
      lede="Was hier besprochen wird, gehört allen — und wandert ins Family-Wissen."
    >
      <FamilyChatView
        scope="shared"
        conversations={conversations}
        activeConversation={active}
        messages={messages}
        facts={facts}
      />
    </FamilyShell>
  );
}
