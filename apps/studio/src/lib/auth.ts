import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAuthService,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import type { AccessContext, AuthUser, StudioRouteAccess, UweArea } from "@uwe/auth";
import {
  AuthRequiredError,
  ForbiddenAccessError,
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  canAccessStudio,
  canPreviewAsPlayer,
  getRequiredAccessForPagePath,
  getUweRuntimeConfig,
  satisfiesStudioRouteAccess,
  requireArea as assertArea,
  requireOwner as assertOwner,
  requireUser as assertUser,
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

export const getCurrentAuthUser = cache(async (): Promise<AuthUser | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  try {
    return auth.toAuthUser(user);
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

export function studioAuthRequired(): boolean {
  return getUweRuntimeConfig().authRequired;
}

/** Synthetic owner used when Studio auth is disabled (trusted-network dev mode). */
export function createDevBypassAuthUser(): AuthUser {
  return {
    id: "dev-bypass",
    displayName: "Dev Bypass",
    email: null,
    isOwner: true,
    access: { portal: true, studio: true, brain: true, family: true },
  };
}

export async function requireUser(): Promise<AuthUser> {
  if (!studioAuthRequired()) {
    return createDevBypassAuthUser();
  }

  const user = await getCurrentAuthUser();
  try {
    return assertUser(user);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/login");
    }
    throw error;
  }
}

export async function requireArea(area: UweArea): Promise<AuthUser> {
  const user = await requireUser();
  try {
    return assertArea(user, area);
  } catch (error) {
    if (error instanceof ForbiddenAccessError) {
      redirect("/login?error=forbidden");
    }
    throw error;
  }
}

export async function requireOwner(): Promise<AuthUser> {
  const user = await requireUser();
  try {
    return assertOwner(user);
  } catch (error) {
    if (error instanceof ForbiddenAccessError) {
      redirect("/login?error=forbidden");
    }
    throw error;
  }
}

export async function requireStudioAccess(): Promise<AuthUser> {
  return requireArea("studio");
}

/** Admin surfaces are owner-only now — the `admin` role is gone. */
export async function requireAdminAccess(): Promise<AuthUser> {
  return requireOwner();
}

export async function enforceStudioPageAuth(pathname: string): Promise<void> {
  if (!studioAuthRequired()) {
    return;
  }

  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/maintenance" ||
    pathname.startsWith("/maintenance/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  ) {
    return;
  }

  if (pathname === "/") {
    return;
  }

  if (pathname === "/logout" || pathname.startsWith("/logout/")) {
    return;
  }

  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    const db = getDb();
    const auth = createAuthService(db);
    try {
      if (await auth.isSetupAvailable()) {
        return;
      }
    } finally {
      await disconnectPrismaClientIfOwned(db);
    }
    redirect("/login");
  }

  const user = await getCurrentAuthUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  const required: StudioRouteAccess = getRequiredAccessForPagePath(pathname);
  if (!satisfiesStudioRouteAccess(user, required)) {
    redirect("/login?error=forbidden");
  }
}

export { getUserFromRequestCookieHeader } from "./auth-session";

export { SESSION_COOKIE_NAME, PREVIEW_COOKIE_NAME, canAccessStudio };
