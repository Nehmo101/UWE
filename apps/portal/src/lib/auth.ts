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
  canAccessPortal,
  canPreviewAsPlayer,
  canReadWorld,
  readSessionTokensFromCookieHeader,
  scopeFromAccessContext,
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
    if (!session || !canAccessPortal(session.user)) {
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
  const db = getDb();
  const auth = createAuthService(db);
  try {
    // LAST-first, matching what `cookies()` resolves on the page path.
    for (const token of readSessionTokensFromCookieHeader(cookieHeader)) {
      const session = await auth.getSessionByToken(token);
      if (session && canAccessPortal(session.user)) {
        return session.user;
      }
    }
    return null;
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
 * Without this check an authenticated Portal user could read any world by
 * guessing its slug: `buildAccessContextForWorld` happily returns a context
 * with `worldMembership: null`. World isolation would exist only in the world
 * LIST (`listAccessibleWorldsForUser`), not in the access path.
 *
 * The Studio checkbox always passes (`canReadWorld`), so DM preview is
 * unaffected.
 */
export const getAccessContextForWorld = cache(async (
  worldSlug: string,
): Promise<AccessContext | null> => {
  const session = await getCurrentSession();
  const previewAsUserId = await getPreviewUserId();

  const db = getDb();
  const auth = createAuthService(db);

  const userId = session?.user.id ?? null;

  const ctx = await auth.buildAccessContextForWorld(worldSlug, {
    userId,
    preview: session && previewAsUserId ? { previewAsUserId } : undefined,
  });

  await disconnectPrismaClientIfOwned(db);

  if (!ctx || !ctx.user || !canAccessPortal(ctx.user)) {
    return null;
  }

  const world = await getPortalWorld(worldSlug);
  if (!world || world.isSandbox) {
    return null;
  }

  // Build the scope through the shared helper, never by hand: it drops a
  // membership that does not belong to this world, which is the only thing
  // keeping worlds apart now.
  const { world: target, ...scope } = scopeFromAccessContext(ctx, world.id);
  return canReadWorld(ctx.user, target, scope) ? ctx : null;
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
