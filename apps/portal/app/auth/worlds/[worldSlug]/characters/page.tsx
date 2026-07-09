import Link from "next/link";
import { notFound } from "next/navigation";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function isOwnMembershipCharacter(
  characterDisplayName: string,
  membershipCharacterName: string | null | undefined,
): boolean {
  if (!membershipCharacterName?.trim()) {
    return false;
  }

  return (
    characterDisplayName.trim().toLocaleLowerCase("de-DE") ===
    membershipCharacterName.trim().toLocaleLowerCase("de-DE")
  );
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

  const membershipCharacterName = ctx.worldMembership?.characterName ?? null;

  return (
    <section className="portal-content-card">
      <h1>Meine Charaktere</h1>
      <p className="auth-lead">
        Strukturierte Charakterbögen in dieser Welt — mit automatisch berechneten Modifikatoren und
        Initiative.
      </p>

      <ul className="auth-page-list">
        {characters.map((character) => {
          const isOwnCharacter = isOwnMembershipCharacter(
            character.displayName,
            membershipCharacterName,
          );
          const stats = (
            <span className="auth-muted">
              Stufe {character.sheet.level} · RK {character.sheet.armorClass ?? "—"} · Init{" "}
              {formatModifier(character.sheet.initiative)} · Passive Wahrnehmung{" "}
              {character.sheet.derived.passivePerception}
            </span>
          );

          return (
            <li key={character.id}>
              {character.pageSlug ? (
                <Link
                  href={`/auth/worlds/${worldSlug}/${character.pageSlug}`}
                  className={isOwnCharacter ? "portal-character-own" : undefined}
                >
                  <strong>{character.displayName}</strong>
                  {isOwnCharacter ? (
                    <span className="auth-page-list-badges">
                      <span className="uwe-badge portal-character-own-badge">Dein Charakter</span>
                    </span>
                  ) : null}
                  {stats}
                </Link>
              ) : (
                <div className={isOwnCharacter ? "portal-character-own" : undefined}>
                  <strong>{character.displayName}</strong>
                  {isOwnCharacter ? (
                    <span className="auth-page-list-badges">
                      <span className="uwe-badge portal-character-own-badge">Dein Charakter</span>
                    </span>
                  ) : null}
                  {stats}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {characters.length === 0 && (
        <PortalEmptyState title="Keine Charakterbögen verfügbar" icon="user" />
      )}
    </section>
  );
}
