import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
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

  const printUrl = `/api/worlds/${worldSlug}/characters/print?characterId=${encodeURIComponent(characterId)}`;
  const markdownUrl = `${printUrl}&format=markdown`;

  return (
    <main className="uwe-v2-page">
      <h1>Charakterbogen — Druck / Export</h1>
      <p className="uwe-hint">Welt: {world.name}</p>
      <p>
        <a href={printUrl} target="_blank" rel="noreferrer" className="uwe-v2-btn uwe-v2-btn-primary">
          Druckansicht öffnen
        </a>{" "}
        <a href={markdownUrl} target="_blank" rel="noreferrer" className="uwe-v2-btn">
          Markdown exportieren
        </a>
      </p>
      <iframe
        title="Charakterbogen Druckvorschau"
        src={printUrl}
        style={{ width: "100%", minHeight: "80vh", border: "1px solid #ccc", marginTop: "1rem" }}
      />
    </main>
  );
}
