import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Wiki/Seiten-Übersicht mit Volltextsuche — Alias für die Seitenliste. */
export default async function WorldWikiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const query = await searchParams;
  const paramsObj = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) paramsObj.set(key, value);
  }
  const qs = paramsObj.toString();
  redirect(`/worlds/${worldSlug}${qs ? `?${qs}` : ""}`);
}
