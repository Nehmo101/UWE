import { redirectLegacyWorldPath } from "@/src/lib/legacy-world-redirect";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function LegacyWorldHomePage({ params }: Props) {
  const { worldSlug } = await params;
  await redirectLegacyWorldPath(worldSlug);
}
