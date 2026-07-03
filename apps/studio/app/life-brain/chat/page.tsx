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
        <p className="uwe-dashboard-muted">
          Master-Admin: Cookbook → KI &amp; RTX Fallback → User-Freigaben →{" "}
          <code>AI_KNOWLEDGE_USE</code> vergeben.
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
