import { StudioWikiPageView } from "@/components/StudioWikiPageView";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
  searchParams: Promise<{ preview?: string; saved?: string }>;
}

export default async function StudioPageView({ params, searchParams }: Props) {
  const { worldSlug, category, slug } = await params;
  const { preview, saved } = await searchParams;

  return (
    <StudioWikiPageView
      worldSlug={worldSlug}
      category={category}
      slug={slug}
      preview={preview}
      saved={saved}
    />
  );
}
