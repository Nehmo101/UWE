import Link from "next/link";
import { buttonVariants } from "@/src/components/ui/button";
import { createSettingsService, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { AiPromptEditorClient } from "./AiPromptEditorClient";

interface Props {
  searchParams: Promise<{
    world?: string;
    page?: string;
    title?: string;
    activated?: string;
  }>;
}

export default async function AdminAiPromptPage({ searchParams }: Props) {
  await requireAdminAccess();
  const { world, page, title, activated } = await searchParams;

  const settings = await createSettingsService(prisma).getSettings();
  const activePrompt = settings.ai.generalChatSystemPrompt ?? "";

  const legacyParams = new URLSearchParams();
  if (world) legacyParams.set("world", world);
  if (page) legacyParams.set("page", page);
  if (title) legacyParams.set("title", title);
  const legacyQs = legacyParams.toString();
  const legacyAiHref = legacyQs ? `/ai?${legacyQs}` : "/ai";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "KI-System-Prompt" },
          ]}
        />
      }
    >
      <PageHeader
        title="KI-System-Prompt"
        summary="System-Prompt für den allgemeinen Chat — Entwurf lokal, explizites Aktivieren verhindert versehentliche Übernahme."
        actions={
          <Link href="/admin/ai-gateway" className={buttonVariants({ variant: "secondary" })}>
            AI Gateway →
          </Link>
        }
      />

      <AiPromptEditorClient
        activePrompt={activePrompt}
        activated={activated === "1"}
        legacyAiHref={legacyAiHref}
      />
    </SystemShell>
  );
}
