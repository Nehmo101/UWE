import { redirect } from "next/navigation";

/**
 * Alt-Route: die Kampagnen-Verwaltung wohnt jetzt in der Kampagnen-Wurzel
 * unter /kampagnen (Liste + Verwaltung + Cockpit-Einstieg). Der Redirect
 * bleibt für Alt-Links und Muskelgedächtnis.
 */
export default async function LegacyCampaignsPage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  redirect(`/worlds/${worldSlug}/kampagnen`);
}
