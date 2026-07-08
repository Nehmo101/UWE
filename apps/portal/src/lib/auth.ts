import { cache } from "react";
import { cookies } from "next/headers";
import {
  createAuthService,
  createUweRepository,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import type { AccessContext } from "@uwe/auth";
import type { SafeUser } from "@uwe/auth";
import {
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  canPreviewAsPlayer,
  canReadWorld,
} from "@uwe/auth";

function getDb() {
  return getSharedPrismaClient();
}

export const getSessionToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
});

export const getPreviewUserId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(PREVIEW_COOKIE_NAME)?.value ?? null;
});

export const getCurrentUser = cache(async () => {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(token);
    return session?.user ?? null;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

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
    await disconnectPrismaClientIfOwned(db);
  }
}

export const getAccessContextForWorld = cache(async (
  worldSlug: string,
): Promise<AccessContext | null> => {
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

  await disconnectPrismaClientIfOwned(db);
  return ctx;
});

export const listAuthWorlds = cache(async () => {
  const user = await getCurrentUser();
  const db = getDb();
  const auth = createAuthService(db);
  try {
    return await auth.listAccessibleWorldsForUser(user?.id ?? null);
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

export async function listPortalWorlds() {
  return listAuthWorlds();
}

export const assertWorldReadable = cache(async (
  worldSlug: string,
): Promise<{
  world: NonNullable<Awaited<ReturnType<ReturnType<typeof createUweRepository>["getWorldBySlug"]>>>;
  ctx: AccessContext;
}> => {
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
});

export async function getWorldPlayers(worldSlug: string) {
  const db = getDb();
  const auth = createAuthService(db);
  try {
    return await auth.listWorldPlayers(worldSlug);
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}

export async function canUsePreview(worldSlug: string): Promise<boolean> {
  const ctx = await getAccessContextForWorld(worldSlug);
  return ctx ? canPreviewAsPlayer(ctx) : false;
}

export { SESSION_COOKIE_NAME, PREVIEW_COOKIE_NAME };
