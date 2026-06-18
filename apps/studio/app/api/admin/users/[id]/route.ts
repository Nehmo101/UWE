import { NextResponse } from "next/server";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { id } = await context.params;
  const service = createUserService(prisma);
  const user = await service.getUserById(id);

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const { id } = await context.params;
  const body = (await request.json()) as {
    displayName?: string;
    email?: string | null;
    role?: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
    forcePasswordChange?: boolean;
  };

  const service = createUserService(prisma);
  const user = await service.updateUser(id, body);

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ user });
}
