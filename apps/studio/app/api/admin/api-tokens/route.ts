import { NextResponse } from "next/server";
import {
  API_TOKEN_SCOPES,
  API_TOKEN_SCOPE_LABELS,
  type ApiTokenScope,
} from "@uwe/auth";
import { createApiTokenService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const user = context.user ?? (await requireAdminAccess());
  const service = createApiTokenService(prisma);
  const tokens = await service.listForUser(user.id);

  return NextResponse.json({
    tokens,
    availableScopes: API_TOKEN_SCOPES.map((scope) => ({
      value: scope,
      label: API_TOKEN_SCOPE_LABELS[scope],
    })),
  });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const user = context.user ?? (await requireAdminAccess());
  const body = (await request.json()) as {
    name?: string;
    scopes?: ApiTokenScope[];
    expiresAt?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }

  const scopes = (body.scopes ?? []).filter((scope): scope is ApiTokenScope =>
    (API_TOKEN_SCOPES as readonly string[]).includes(scope),
  );

  if (scopes.length === 0) {
    return NextResponse.json({ error: "Mindestens ein Scope erforderlich." }, { status: 400 });
  }

  const service = createApiTokenService(prisma);
  const created = await service.create({
    userId: user.id,
    userRole: user.role,
    name: body.name.trim(),
    scopes,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  });

  return NextResponse.json({
    token: created.token,
    plaintextToken: created.plaintextToken,
    warning: "Token wird nur einmal angezeigt. Speichere ihn sicher — er wird nicht erneut ausgegeben.",
  });
}
