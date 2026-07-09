import { NextResponse } from "next/server";
import { createDevBypassAuthUser, getCurrentAuthUser, studioAuthRequired } from "./auth";

export interface OwnerApiUser {
  userId: string;
  role: string;
}

/**
 * Resolve the current request's user for Owner-only API routes.
 *
 * Prefers the real session user (so AI usage logging references a valid user).
 * Mirrors `requireUser()`'s dev-bypass only as a fallback: when there is no
 * session and Studio auth is not required (trusted-network dev mode), the
 * operator is treated as the Owner. Returns `null` when the caller is not the Owner.
 */
export async function resolveOwnerApiUser(): Promise<OwnerApiUser | null> {
  const user = await getCurrentAuthUser();
  if (user) {
    return user.role === "owner" ? { userId: user.id, role: user.role } : null;
  }

  if (!studioAuthRequired()) {
    const bypass = createDevBypassAuthUser();
    return { userId: bypass.id, role: bypass.role };
  }
  return null;
}

export function ownerForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "Nur der Owner darf das Ideen-Management nutzen." },
    { status: 403 },
  );
}
