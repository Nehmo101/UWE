import { notFound, redirect } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { requireStudioWorldRead } from "@/src/lib/authz";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

/**
 * Der Kampagnen-Radar ist im Kampagnen-Modul aufgegangen: seine Karten
 * (Dungeons, NSC-Stand, Fraktionen, Quests, Chronik) zeigt der
 * Kampagnen-Überblick, die Weltuhr das Welt-Dashboard. Alt-Bookmarks landen
 * hier und werden weitergeleitet — dasselbe Muster wie der `campaigns/`-Stub.
 */
export default async function CampaignRadarRedirect({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  await requireStudioWorldRead(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const base = `/worlds/${worldSlug}/kampagnen`;
  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  if (campaignSlug && campaigns.some((candidate) => candidate.slug === campaignSlug)) {
    redirect(`${base}/${campaignSlug}`);
  }
  if (campaigns.length === 1) {
    redirect(`${base}/${campaigns[0]!.slug}`);
  }
  redirect(base);
}
