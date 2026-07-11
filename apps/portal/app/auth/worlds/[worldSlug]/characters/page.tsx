import Link from "next/link";
import { notFound } from "next/navigation";
import { isWorldStaff } from "@uwe/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/components/ui/cn";

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
  const staffView = isWorldStaff(ctx);

  return (
    <>
      <PageHeader
        title="Meine Charaktere"
        summary="Strukturierte Charakterbögen in dieser Welt — mit automatisch berechneten Modifikatoren und Initiative."
      />

      <ul className="grid gap-2">
        {characters.map((character) => {
          const isOwnCharacter = isOwnMembershipCharacter(
            character.displayName,
            membershipCharacterName,
          );
          const stats = (
            <span className="mt-1 block text-sm text-muted-foreground">
              Stufe {character.sheet.level} · RK {character.sheet.armorClass ?? "—"} · Init{" "}
              {formatModifier(character.sheet.initiative)} · Passive Wahrnehmung{" "}
              {character.sheet.derived.passivePerception}
            </span>
          );

          const content = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{character.displayName}</strong>
                {isOwnCharacter ? (
                  <Badge variant="accent">Dein Charakter</Badge>
                ) : null}
              </div>
              {stats}
            </>
          );

          return (
            <li key={character.id}>
              {character.pageSlug ? (
                <Link
                  href={`/auth/worlds/${worldSlug}/${character.pageSlug}`}
                  className={cn(
                    "block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50",
                    isOwnCharacter && "border-primary/40 bg-primary/5",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className={cn(
                    "rounded-[var(--radius)] border border-border p-4",
                    isOwnCharacter && "border-primary/40 bg-primary/5",
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {characters.length === 0 ? (
        <PortalEmptyState
          title={staffView ? "Noch keine Charakterbögen angelegt" : "Keine Charakterbögen verfügbar"}
          description={
            staffView
              ? "Als Owner/DM siehst du hier alle Charakterbögen der Welt. Lege sie im Studio auf einer Spielercharakter-Seite unter „Charakterbogen erstellen“ an."
              : undefined
          }
          icon="user"
        />
      ) : null}
    </>
  );
}
