import Link from "next/link";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";
import { AdminModuleShell } from "@/components/AdminModuleShell";

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
    <AdminModuleShell
      activePath="/admin/ai-prompt"
      bottomNav="ai"
      title="KI-Prompt"
      summary="Schneller Chat mit lokaler RTX-KI oder Cloud — mit sichtbaren Datenschutzregeln und Status."
      breadcrumbs={[{ label: "Dashboard", href: "/studio" }, { label: "KI-Prompt" }]}
    >
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
    </AdminModuleShell>
  );
}
