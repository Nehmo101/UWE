import { createFamilyService } from "@uwe/database/family-service";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { FamilyChatView } from "@/src/components/FamilyChatView";

/**
 * Privater Chat (G19) — nur die schreibende Person sieht ihn.
 *
 * Die Trennung läuft über Eigentum (`ownerUserId`), nicht über ein
 * Sichtbarkeits-Label: der Service filtert fremdes Privates strukturell weg.
 * Der Owner ist der Sonderfall aus G.2b — sein privates Wissen gehört ins
 * Owner-Brain (`apps/brain`), nicht hierher; die Seite sagt das auch.
 */

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ c?: string }>;
}

export default async function FamilyPrivateChatPage({ searchParams }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/chat/privat" title="Privater Chat">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { c } = await searchParams;
  const service = createFamilyService(familyPrisma);
  const conversations = await service.listConversations(user.id, "private");
  const active = c ? await service.getConversation(c, user.id) : conversations[0] ?? null;
  const [messages, facts] = await Promise.all([
    active ? service.listMessages(active.id, user.id) : Promise.resolve([]),
    service.listFacts(user.id, "private"),
  ]);

  return (
    <FamilyShell
      active="/chat/privat"
      title="Privater Chat"
      eyebrow="Nur du"
      lede={
        user.isOwner
          ? "Nur du siehst das hier. Dein eigentliches privates Wissen liegt im Owner-Brain — dieser Chat ist der Family-Ableger davon."
          : "Nur du siehst das hier. Niemand sonst in der Family, auch nicht der Owner."
      }
    >
      <FamilyChatView
        scope="private"
        conversations={conversations}
        activeConversation={active}
        messages={messages}
        facts={facts}
      />
    </FamilyShell>
  );
}
