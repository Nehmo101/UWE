import { redirectLegacyWorldPath } from "@/src/lib/legacy-world-redirect";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
}

export default async function LegacyWorldWikiPage({ params }: Props) {
  const { worldSlug, slug } = await params;
  await redirectLegacyWorldPath(worldSlug, `/${slug}`);
}
