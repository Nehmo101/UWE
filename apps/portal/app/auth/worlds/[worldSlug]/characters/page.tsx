import Link from "next/link";
import { notFound } from "next/navigation";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export default async function PortalCharactersPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let characters;
  try {
    characters = await auth.listCharactersForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card">
      <h1>Meine Charaktere</h1>
      <p className="auth-lead">
        Strukturierte Charakterbögen in dieser Welt — mit automatisch berechneten Modifikatoren und
        Initiative.
      </p>

      <ul className="auth-page-list">
        {characters.map((character) => (
          <li key={character.id}>
            {character.pageSlug ? (
              <Link href={`/auth/worlds/${worldSlug}/${character.pageSlug}`}>
                <strong>{character.displayName}</strong>
                <span className="auth-muted">
                  Stufe {character.sheet.level} · RK {character.sheet.armorClass ?? "—"} · Init{" "}
                  {formatModifier(character.sheet.initiative)} · Passive Wahrnehmung{" "}
                  {character.sheet.derived.passivePerception}
                </span>
              </Link>
            ) : (
              <div>
                <strong>{character.displayName}</strong>
                <span className="auth-muted">
                  Stufe {character.sheet.level} · RK {character.sheet.armorClass ?? "—"} · Init{" "}
                  {formatModifier(character.sheet.initiative)} · Passive Wahrnehmung{" "}
                  {character.sheet.derived.passivePerception}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {characters.length === 0 && (
        <p className="auth-muted">Noch keine Charakterbögen für deine Rolle verfügbar.</p>
      )}
    </section>
  );
}
