import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/** Der alte 2D-Atlas wurde durch Atlas 3D ersetzt — Alt-Links laufen dorthin. */
export default async function LegacyAtlasRedirect({ params }: Props) {
  const { worldSlug } = await params;
  redirect(`/worlds/${worldSlug}/atlas3d`);
}
