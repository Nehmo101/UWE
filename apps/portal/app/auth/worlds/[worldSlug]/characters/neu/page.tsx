import { notFound, redirect } from "next/navigation";
import { createFullCharacterAction } from "@/app/character-actions";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { CharacterWizard } from "@/src/components/character-wizard/CharacterWizard";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export const metadata = {
  title: "Charakter erstellen",
};

/**
 * Der Charakter-Ersteller.
 *
 * Wer hier hin darf, ist dieselbe Frage wie beim alten Ein-Feld-Formular
 * (`createOwnCharacterAction`): angemeldet, der Welt zugeordnet, keine
 * Vorschau-Sitzung. Die Prüfung steht bewusst **zweimal** — hier, damit
 * niemand eine Seite sieht, die er nicht abschicken kann, und noch einmal
 * in der Server Action, weil ein Formular auch ohne diese Seite abgeschickt
 * werden kann.
 */
export default async function NewCharacterPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const canCreate = Boolean(ctx.user) && !ctx.previewAsUserId && ctx.worldMembership !== null;
  if (!canCreate) {
    // Lesende ohne Welt-Zuordnung landen wieder auf der Liste — dort steht,
    // warum hier nichts anzulegen ist.
    redirect(`/auth/worlds/${worldSlug}/characters`);
  }

  return (
    <>
      <PageHeader
        title="Charakter erstellen"
        summary="Volk, Klasse, Hintergrund, Werte — in neun Schritten zum fertigen Bogen. Dein Entwurf bleibt erhalten, auch wenn du zwischendurch weggehst."
      />
      <CharacterWizard worldSlug={worldSlug} createAction={createFullCharacterAction} />
    </>
  );
}
