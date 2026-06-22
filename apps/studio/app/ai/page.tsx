import { AdminModuleShell } from "@/components/AdminModuleShell";
import { resolveAiChatAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";

export default async function AiPage() {
  const user = await getCurrentAuthUser();
  const access = await resolveAiChatAccess(user);
  const useMock = process.env.AI_USE_MOCK === "true";

  if (!access.allowed) {
    return (
      <AdminModuleShell
        activePath="/ai"
        title="KI"
        summary={access.message}
        bottomNav="ai"
      >
        <p className="uwe-dashboard-muted">
          Master-Admin: Cookbook → KI &amp; RTX Fallback → User-Freigaben →{" "}
          <code>AI_CHAT_USE</code> vergeben.
        </p>
      </AdminModuleShell>
    );
  }

  return (
    <AdminModuleShell
      activePath="/ai"
      title="KI"
      summary="Allgemeiner Chat ohne lokalen Brain-/Objekt-Kontext. DnD-Kontext nur in Welten verfügbar."
      bottomNav="ai"
    >
      <MobileAiPromptPanel useMock={useMock} pollIntervalMs={30_000} />
    </AdminModuleShell>
  );
}
