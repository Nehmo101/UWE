import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";

interface Props {
  searchParams: Promise<{
    world?: string;
    page?: string;
    title?: string;
  }>;
}

export default async function AdminAiPromptPage({ searchParams }: Props) {
  const { world, page, title } = await searchParams;
  const useMock = process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("ai")}
      topBar={<TopBarBrand appName="UWE Studio" subtitle="KI-Prompt" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/" },
              { label: "KI-Prompt", href: "/admin/ai-prompt", active: true },
              { label: "Systemstatus", href: "/admin/status" },
              { label: "Einstellungen", href: "/settings" },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: "KI-Prompt" },
            ]}
          />

          <PageHeader
            title="KI-Prompt"
            summary="Schneller Chat mit lokaler RTX-KI oder Cloud — mit sichtbaren Datenschutzregeln und Status."
          />

          {!world && (
            <p className="mobile-ai-page-hint">
              Für Objekt-Kontext eine Wiki-Seite öffnen und über{" "}
              <Link href="/worlds">Welten</Link> verknüpfen, oder URL-Parameter{" "}
              <code>?world=…&amp;page=…</code> nutzen.
            </p>
          )}

          <MobileAiPromptPanel
            worldSlug={world}
            pageSlug={page}
            pageTitle={title}
            useMock={useMock}
          />
        </>
      }
    />
  );
}
