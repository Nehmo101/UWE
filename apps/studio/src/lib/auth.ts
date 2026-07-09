import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAuthService,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import type { AccessContext, AuthUser, UweRole } from "@uwe/auth";
import {
  ADMIN_ACCESS_ROLES,
  AuthRequiredError,
  ForbiddenRoleError,
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  STUDIO_ACCESS_ROLES,
  canAccessStudio,
  canPreviewAsPlayer,
  getRequiredRolesForPagePath,
  getUweRuntimeConfig,
  hasAnyRole,
  requireRole as assertRole,
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
    role: "owner",
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

export async function requireRole(allowed: readonly UweRole[]): Promise<AuthUser> {
  const user = await requireUser();
  try {
    return assertRole(user, allowed);
  } catch (error) {
    if (error instanceof ForbiddenRoleError) {
      redirect("/login?error=forbidden");
    }
    throw error;
  }
}

export async function requireOwner(): Promise<AuthUser> {
  return requireRole(["owner"]);
}

export async function requireStudioAccess(): Promise<AuthUser> {
  return requireRole(STUDIO_ACCESS_ROLES);
}

export async function requireAdminAccess(): Promise<AuthUser> {
  return requireRole(ADMIN_ACCESS_ROLES);
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

  const requiredRoles = getRequiredRolesForPagePath(pathname);
  if (requiredRoles && !hasAnyRole(user, requiredRoles)) {
    redirect("/login?error=forbidden");
  }
}

export { getUserFromRequestCookieHeader } from "./auth-session";

export { SESSION_COOKIE_NAME, PREVIEW_COOKIE_NAME, canAccessStudio, ADMIN_ACCESS_ROLES, STUDIO_ACCESS_ROLES };
