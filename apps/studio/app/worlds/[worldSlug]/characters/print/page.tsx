import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { CharacterPrintFormatPicker } from "@/src/components/characters/CharacterPrintFormatPicker";
import { requireStudioWorldRead } from "@/src/lib/authz";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ characterId?: string }>;
}

export default async function CharacterPrintPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { characterId } = await searchParams;

  try {
    await requireStudioWorldRead(worldSlug);
  } catch {
    notFound();
  }

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  if (!characterId) {
    return (
      <main className="uwe-v2-page">
        <h1>Charakterbogen drucken</h1>
        <p className="uwe-hint">
          Bitte <code>characterId</code> als Query-Parameter angeben, z. B. von der Charakterseite
          verlinkt.
        </p>
        <Link href={`/worlds/${worldSlug}`}>← Zurück zur Welt</Link>
      </main>
    );
  }

  return (
    <CharacterPrintFormatPicker
      worldSlug={worldSlug}
      characterId={characterId}
      worldName={world.name}
    />
  );
}
