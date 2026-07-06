import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
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
  const user = await service.getUserForAdmin(id);

  if (!user) {
    return jsonError("Benutzer nicht gefunden.", 404);
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
    status?: "invited" | "active" | "disabled";
    forcePasswordChange?: boolean;
  };

  const service = createUserService(prisma);

  try {
    const user = await service.updateUser(id, body, authContext.user?.id ?? null);
    if (!user) {
      return jsonError("Benutzer nicht gefunden.", 404);
    }
    return NextResponse.json({ user });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits vergeben." },
        { status: 409 },
      );
    }
    if (code === "LAST_OWNER_ROLE") {
      return NextResponse.json(
        { error: "Die Rolle des letzten Owners kann nicht geändert werden." },
        { status: 400 },
      );
    }
    return jsonError("Anfrage konnte nicht verarbeitet werden.", 400);
  }
}
