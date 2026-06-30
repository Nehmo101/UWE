import { cookies } from "next/headers";
import {
  createAuthService,
  createPrismaClient,
  createUweRepository,
} from "@uwe/database/server";
import type { AccessContext } from "@uwe/auth";
import type { SafeUser } from "@uwe/auth";
import {
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  canPreviewAsPlayer,
  canReadWorld,
} from "@uwe/auth";

function getDb() {
  return createPrismaClient();
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getPreviewUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PREVIEW_COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  const session = await auth.getSessionByToken(token);
  await db.$disconnect();

  return session?.user ?? null;
}

export async function getUserFromRequestCookieHeader(
  cookieHeader: string | null,
): Promise<SafeUser | null> {
  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!token) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(decodeURIComponent(token));
    return session?.user ?? null;
  } finally {
    await db.$disconnect();
  }
}

export async function getAccessContextForWorld(
  worldSlug: string,
): Promise<AccessContext | null> {
  const token = await getSessionToken();
  const previewAsUserId = await getPreviewUserId();

  const db = getDb();
  const auth = createAuthService(db);

  let userId: string | null = null;
  if (token) {
    const session = await auth.getSessionByToken(token);
    userId = session?.user.id ?? null;
  }

  const ctx = await auth.buildAccessContextForWorld(worldSlug, {
    userId,
    preview: previewAsUserId ? { previewAsUserId } : undefined,
  });

  await db.$disconnect();
  return ctx;
}

export async function listAuthWorlds() {
  const user = await getCurrentUser();
  const db = getDb();
  const auth = createAuthService(db);
  const worlds = await auth.listAccessibleWorldsForUser(user?.id ?? null);
  await db.$disconnect();
  return worlds;
}

export async function listPortalWorlds() {
  return listAuthWorlds();
}

export async function assertWorldReadable(
  worldSlug: string,
): Promise<{
  world: NonNullable<Awaited<ReturnType<ReturnType<typeof createUweRepository>["getWorldBySlug"]>>>;
  ctx: AccessContext;
}> {
  const ctx = await getAccessContextForWorld(worldSlug);
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(worldSlug);

  if (
    !world ||
    world.isSandbox ||
    !ctx ||
    !canReadWorld(ctx.user, {
      id: world.id,
      guestModeEnabled: ctx.guestModeEnabled,
      membership: ctx.worldMembership,
    })
  ) {
    throw new Error("WORLD_FORBIDDEN");
  }

  return { world, ctx };
}

export async function getWorldPlayers(worldSlug: string) {
  const db = getDb();
  const auth = createAuthService(db);
  const players = await auth.listWorldPlayers(worldSlug);
  await db.$disconnect();
  return players;
}

export async function canUsePreview(worldSlug: string): Promise<boolean> {
  const ctx = await getAccessContextForWorld(worldSlug);
  return ctx ? canPreviewAsPlayer(ctx) : false;
}

export { SESSION_COOKIE_NAME, PREVIEW_COOKIE_NAME };
