import { cache } from "react";
import { cookies } from "next/headers";
import {
  createAuthService,
  createUweRepositoryFromClient,
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

export const getCurrentSession = cache(async () => {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(token);
    if (!session) {
      return null;
    }
    return {
      id: session.id,
      user: session.user,
    };
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  return session?.user ?? null;
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

/** World record for the current request, shared by the access gate and the shell. */
export const getPortalWorld = cache(async (worldSlug: string) => {
  const db = getDb();
  try {
    return await createUweRepositoryFromClient(db).getWorldBySlug(worldSlug);
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

/**
 * Access context for a Portal world, or `null` when the viewer may not read it.
 *
 * The world-membership gate lives HERE, not in the world layout: a Next.js
 * layout does not re-run for every navigation within its segment, and the
 * Portal's 20 world pages plus its Server Actions all funnel through this
 * function. Returning `null` makes each caller's existing `if (!ctx)
 * notFound()` do the right thing — and 404 rather than 403 avoids confirming
 * that a foreign world exists.
 *
 * Without this check an authenticated player could read any world by guessing
 * its slug: `buildAccessContextForWorld` happily returns a context with
 * `worldMembership: null`, `resolveEffectiveRole` then yields "player", and
 * `canViewPage` grants every `player_visible` page. World isolation would exist
 * only in the world LIST (`listAccessibleWorldsForUser`), not in the access path.
 *
 * owner/admin/dm always pass (`canReadWorld`), so DM preview is unaffected.
 */
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

  if (!ctx) {
    return null;
  }

  const world = await getPortalWorld(worldSlug);
  if (!world || world.isSandbox) {
    return null;
  }

  // `ctx.guestModeEnabled` is the settings-aware value (world flag AND the
  // global guest-portal setting) — do not substitute `world.guestModeEnabled`.
  const readable = canReadWorld(ctx.user, {
    id: world.id,
    guestModeEnabled: ctx.guestModeEnabled,
    membership: ctx.worldMembership,
  });

  return readable ? ctx : null;
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

export type ReadableWorld = NonNullable<Awaited<ReturnType<typeof getPortalWorld>>>;

/**
 * World + access context for a viewer who is allowed to read it, or `null`.
 * Use in layouts/shells that render world metadata (name, breadcrumb) — those
 * must not disclose a foreign world's name either.
 */
export const loadReadableWorld = cache(async (
  worldSlug: string,
): Promise<{ world: ReadableWorld; ctx: AccessContext } | null> => {
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    return null;
  }

  const world = await getPortalWorld(worldSlug);
  return world ? { world, ctx } : null;
});

/** Throwing variant of {@link loadReadableWorld} for non-rendering callers. */
export const assertWorldReadable = cache(async (
  worldSlug: string,
): Promise<{ world: ReadableWorld; ctx: AccessContext }> => {
  const readable = await loadReadableWorld(worldSlug);
  if (!readable) {
    throw new Error("WORLD_FORBIDDEN");
  }
  return readable;
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
