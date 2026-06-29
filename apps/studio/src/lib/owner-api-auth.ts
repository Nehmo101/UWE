import { NextResponse } from "next/server";
import { getCurrentAuthUser, studioAuthRequired } from "./auth";

export interface OwnerApiUser {
  userId: string;
  role: string;
}

/**
 * Resolve the current request's user for Owner-only API routes.
 * Mirrors `requireUser()`'s dev-bypass: when Studio auth is not required
 * (trusted-network dev mode) the operator is treated as the Owner.
 * Returns `null` when the caller is not the Owner.
 */
export async function resolveOwnerApiUser(): Promise<OwnerApiUser | null> {
  if (!studioAuthRequired()) {
    return { userId: "dev-bypass", role: "owner" };
  }

  const user = await getCurrentAuthUser();
  if (!user || user.role !== "owner") {
    return null;
  }
  return { userId: user.id, role: user.role };
}

export function ownerForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "Nur der Owner darf das Ideen-Management nutzen." },
    { status: 403 },
  );
}
