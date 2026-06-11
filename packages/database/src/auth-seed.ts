import type { AuthService } from "./auth";
import type { UweRepository } from "./repository";
import { hashPassword } from "@uwe/auth";

/** Default dev password for all seed users. */
export const DEV_SEED_PASSWORD = "uwe-dev";

export interface SeedAuthUsersResult {
  dm: { id: string; displayName: string; email: string };
  players: Array<{
    id: string;
    displayName: string;
    email: string;
    characterName: string;
  }>;
}

export async function seedAuthUsers(
  auth: AuthService,
  repo: UweRepository,
  worldId: string,
): Promise<SeedAuthUsersResult> {
  const dm = await auth.createUser({
    displayName: "DM User",
    email: "dm@uwe.local",
    password: DEV_SEED_PASSWORD,
    role: "dm",
  });

  await auth.createWorldMembership({
    userId: dm.id,
    worldId,
    role: "owner",
  });

  const playerDefs = [
    { displayName: "Aman", email: "aman@uwe.local", characterName: "Aman" },
    { displayName: "Lazul", email: "lazul@uwe.local", characterName: "Lazul" },
    { displayName: "Veldrin", email: "veldrin@uwe.local", characterName: "Veldrin" },
    { displayName: "Finnion", email: "finnion@uwe.local", characterName: "Finnion" },
  ] as const;

  const players = [];

  for (const def of playerDefs) {
    const user = await auth.createUser({
      displayName: def.displayName,
      email: def.email,
      password: DEV_SEED_PASSWORD,
      role: "player",
    });

    await auth.createWorldMembership({
      userId: user.id,
      worldId,
      role: "player",
      characterName: def.characterName,
    });

    players.push({
      id: user.id,
      displayName: user.displayName,
      email: def.email,
      characterName: def.characterName,
    });
  }

  return {
    dm: {
      id: dm.id,
      displayName: dm.displayName,
      email: "dm@uwe.local",
    },
    players,
  };
}

export async function seedAuthDemoContent(
  auth: AuthService,
  repo: UweRepository,
  worldId: string,
  playerUserIds: Record<string, string>,
) {
  const secretForAman = await repo.createPage({
    worldId,
    title: "Amans Geheimnis",
    slug: "amans-geheimnis",
    type: "note",
    summary: "Nur für Aman freigegeben.",
    visibility: "specific_players",
    publishStatus: "published",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        visibility: "specific_players",
        content: "Du hast einen verborgenen Hinweis im Turm gefunden.",
      },
    ],
  });

  await auth.grantPagePlayerAccess(secretForAman.id, playerUserIds.aman);

  const sessionLocked = await repo.createPage({
    worldId,
    title: "Nach der ersten Session",
    slug: "nach-der-ersten-session",
    type: "note",
    summary: "Wird nach Session 1 freigeschaltet.",
    visibility: "unlock_after_session",
    publishStatus: "published",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        visibility: "unlock_after_session",
        content: "Nach der ersten Session erfahrt ihr von der Verschwörung.",
      },
    ],
  });

  await auth.unlockPageForUser(sessionLocked.id, playerUserIds.lazul, "Session 1");

  await repo.createPage({
    worldId,
    title: "Archivierte Notiz",
    slug: "archivierte-notiz",
    type: "note",
    summary: "Sollte im Portal nicht erscheinen.",
    visibility: "archived",
    publishStatus: "published",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "public",
        content: "Archivierter Inhalt.",
      },
    ],
  });

  return {
    secretForAman,
    sessionLocked,
  };
}

/** Exported for tests that need a known password hash. */
export { hashPassword };
