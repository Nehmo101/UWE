import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAuthService,
  createPrismaClient,
} from "@uwe/database/server";
import type { AuthUser, UweRole } from "@uwe/auth";
import {
  ADMIN_ACCESS_ROLES,
  AuthRequiredError,
  ForbiddenRoleError,
  SESSION_COOKIE_NAME,
  STUDIO_ACCESS_ROLES,
  canAccessStudio,
  getRequiredRolesForPagePath,
  getUweRuntimeConfig,
  hasAnyRole,
  requireRole as assertRole,
  requireUser as assertUser,
} from "@uwe/auth";

function getDb() {
  return createPrismaClient();
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUser() {
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
    await db.$disconnect();
  }
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const db = getDb();
  const auth = createAuthService(db);
  try {
    return auth.toAuthUser(user);
  } finally {
    await db.$disconnect();
  }
}

export function studioAuthRequired(): boolean {
  return getUweRuntimeConfig().authRequired;
}

export async function requireUser(): Promise<AuthUser> {
  if (!studioAuthRequired()) {
    return {
      id: "dev-bypass",
      displayName: "Dev Bypass",
      email: null,
      role: "owner",
    };
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
      await db.$disconnect();
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

export { SESSION_COOKIE_NAME, canAccessStudio, ADMIN_ACCESS_ROLES, STUDIO_ACCESS_ROLES };
