import { notFound } from "next/navigation";
import { PortalGraphView } from "@/src/components/PortalGraphView";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";

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

  const db = getSharedPrismaClient();
  let worldName = "";
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) {
      notFound();
    }
    worldName = world.name;

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  return (
    <section className="relative min-h-[70vh]">
      <h1 className="sr-only">Beziehungsnetz — {worldName}</h1>
      <PortalGraphView
        worldSlug={worldSlug}
        worldName={worldName}
        focusPageId={focusPageId}
        mode={mode === "focus" || mode === "neighbors" || mode === "backlinks" ? mode : undefined}
      />
    </section>
  );
}
