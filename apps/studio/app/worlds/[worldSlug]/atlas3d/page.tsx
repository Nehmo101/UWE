import { notFound, redirect } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Atlas 3D entry: bootstrap the world's atlas (lazy) and jump straight onto
 * the globe. The old 2D atlas keeps running in parallel until phase 5.
 */
export default async function Atlas3DIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const { rootNode } = await atlas3d.getOrCreateForWorld(worldSlug);

  redirect(`/worlds/${worldSlug}/atlas3d/${rootNode.id}`);
}
