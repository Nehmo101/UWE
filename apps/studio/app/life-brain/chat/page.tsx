import Link from "next/link";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { LifeBrainChatPanel } from "@/components/life-brain/LifeBrainChatPanel";
import { resolveAiKnowledgeAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function LifeBrainChatPage() {
  const user = await getCurrentAuthUser();
  const access = await resolveAiKnowledgeAccess(user);
  const useMock = process.env.AI_USE_MOCK === "true";

  const breadcrumb = (
    <BreadcrumbTrail
      items={[{ label: "Persönliches Brain", href: "/life-brain" }, { label: "Chat" }]}
    />
  );

  if (!access.allowed) {
    return (
      <StudioShell breadcrumb={breadcrumb}>
        <PageHeader title="Life-Brain Chat" summary={access.message} />
        <p className="text-sm text-muted-foreground">
          Master-Admin:{" "}
          <Link href="/admin/ai-gateway">KI-Gateway</Link> → User-Freigaben →{" "}
          <code>AI_KNOWLEDGE_USE</code> vergeben. RTX-Setup:{" "}
          <Link href="/system/rtx-connector">RTX Connector</Link>.
        </p>
      </StudioShell>
    );
  }

  return (
    <StudioShell breadcrumb={breadcrumb}>
      <PageHeader
        title="Life-Brain Chat"
        summary="Konversation über dein persönliches Wissen — lokal-only, kein Cloud-Fallback."
      />
      <LifeBrainChatPanel useMock={useMock} pollIntervalMs={30_000} />
    </StudioShell>
  );
}
