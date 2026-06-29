import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { resolveAiChatAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";

export default async function AiPage() {
  const user = await getCurrentAuthUser();
  const access = await resolveAiChatAccess(user);
  const useMock = process.env.AI_USE_MOCK === "true";

  if (!access.allowed) {
    return (
      <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "KI" }]} />}>
        <PageHeader title="KI" summary={access.message} />
        <p className="uwe-dashboard-muted">
          Master-Admin: Cookbook → KI &amp; RTX Fallback → User-Freigaben →{" "}
          <code>AI_CHAT_USE</code> vergeben.
        </p>
      </StudioShell>
    );
  }

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "KI" }]} />}>
      <PageHeader
        title="KI"
        summary="Allgemeiner Chat ohne lokalen Brain-/Objekt-Kontext. DnD-Kontext nur in Welten verfügbar."
      />
      <MobileAiPromptPanel useMock={useMock} pollIntervalMs={30_000} />
    </StudioShell>
  );
}
