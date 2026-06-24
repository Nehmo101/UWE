import { NextResponse } from "next/server";
import { createDashboardLayoutService, createPrismaClient } from "@uwe/database/server";
import { getUweRuntimeConfig } from "@uwe/auth";
import { requirePortalApiAuth as requirePortalCsrfAuth } from "@uwe/security";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";

interface RouteParams {
  params: Promise<{ pageKey: string }>;
}

async function requireLayoutSessionUser(request: Request) {
  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (user) {
    return { user };
  }

  if (!getUweRuntimeConfig().authRequired) {
    return {
      user: {
        id: "dev-bypass",
        displayName: "Dev Bypass",
        email: null,
        role: "owner" as const,
        status: "active" as const,
      },
    };
  }

  return {
    error: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const session = await requireLayoutSessionUser(request);
  if ("error" in session) return session.error;

  const { pageKey } = await params;
  const decodedPageKey = decodeURIComponent(pageKey);
  const db = createPrismaClient();
  const service = createDashboardLayoutService(db);

  try {
    const layout = await service.getDashboardLayout(session.user.id, decodedPageKey);
    return NextResponse.json(layout);
  } finally {
    await db.$disconnect();
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authError = requirePortalCsrfAuth(request);
  if (authError) return authError;

  const portalAuthError = await requirePortalApiAuth(request);
  if (portalAuthError) return portalAuthError;

  const session = await requireLayoutSessionUser(request);
  if ("error" in session) return session.error;

  let body: { widgets?: unknown };
  try {
    body = (await request.json()) as { widgets?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!Array.isArray(body.widgets)) {
    return NextResponse.json({ error: "widgets muss ein Array sein." }, { status: 400 });
  }

  const { pageKey } = await params;
  const decodedPageKey = decodeURIComponent(pageKey);
  const db = createPrismaClient();
  const service = createDashboardLayoutService(db);

  try {
    const layout = await service.saveDashboardLayout(
      session.user.id,
      decodedPageKey,
      body.widgets as Parameters<typeof service.saveDashboardLayout>[2],
    );
    return NextResponse.json(layout);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Layout konnte nicht gespeichert werden." },
      { status: 400 },
    );
  } finally {
    await db.$disconnect();
  }
}
