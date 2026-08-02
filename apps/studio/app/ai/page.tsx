import Link from "next/link";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { resolveAiChatAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";
import { AiHubShortcuts } from "@/components/ai/AiHubShortcuts";

export default async function AiPage() {
  const user = await getCurrentAuthUser();
  const access = await resolveAiChatAccess(user);
  const useMock = process.env.AI_USE_MOCK === "true";

  if (!access.allowed) {
    return (
      <>
        <ShellBreadcrumb items={[{ label: "KI" }]} />
        <PageHeader title="KI" summary={access.message} />
        <p className="text-sm text-muted-foreground">
          Master-Admin:{" "}
          <Link href="/admin/ai-gateway">KI-Gateway</Link> → User-Freigaben →{" "}
          <code>AI_CHAT_USE</code> vergeben.
        </p>
      </>
    );
  }

  return (
    <>
      <ShellBreadcrumb items={[{ label: "KI" }]} />
      <PageHeader
        title="KI"
        summary="Allgemeiner Chat ohne lokalen Brain-/Objekt-Kontext. DnD-Kontext nur in Welten verfügbar."
      />
      <AiHubShortcuts />
      <MobileAiPromptPanel useMock={useMock} pollIntervalMs={30_000} />
    </>
  );
}
