import { notFound } from "next/navigation";
import { PortalGraphView } from "@/src/components/PortalGraphView";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ focusPageId?: string; mode?: string }>;
}

export default async function AuthWorldGraphPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { focusPageId, mode } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      notFound();
    }

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card">
      <h1>Beziehungsnetz</h1>
      <p className="auth-lead">
        Sichtbare Wiki-Seiten und ihre Verknüpfungen — nur Inhalte, die für deine Rolle freigegeben
        sind.
      </p>
      <PortalGraphView
        worldSlug={worldSlug}
        focusPageId={focusPageId}
        mode={mode === "focus" || mode === "neighbors" || mode === "backlinks" ? mode : undefined}
      />
    </section>
  );
}
