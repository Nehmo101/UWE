import { NextResponse } from "next/server";
import { createDashboardLayoutService, prisma } from "@uwe/database/server";
import { getUweRuntimeConfig } from "@uwe/auth";
import { guardStudioMutation, requireStudioApiAuth } from "@uwe/security";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";

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
      },
    };
  }

  return {
    error: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const session = await requireLayoutSessionUser(request);
  if ("error" in session) return session.error;

  const { pageKey } = await params;
  const decodedPageKey = decodeURIComponent(pageKey);
  const service = createDashboardLayoutService(prisma);
  const layout = await service.getDashboardLayout(session.user.id, decodedPageKey);
  return NextResponse.json(layout);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

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
  const service = createDashboardLayoutService(prisma);

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
  }
}
