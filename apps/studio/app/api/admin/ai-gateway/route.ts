import {
  deleteAiCloudProvider,
  deleteAiUserGrant,
  getAiGatewayAccessStatus,
  getAiGatewayDashboard,
  getAiGatewayUsage,
  patchAiGatewayConfig,
  postAiGatewayFallbackTest,
  postAiGatewaySimulate,
  upsertAiCloudProvider,
  upsertAiUserGrant,
} from "@/src/lib/ai-gateway-handlers";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { guardStudioMutation, requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = await getCurrentAuthUser();
  const url = new URL(request.url);

  if (url.searchParams.get("scope") === "access") {
    return getAiGatewayAccessStatus(user);
  }

  if (url.searchParams.get("scope") === "usage") {
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const successParam = url.searchParams.get("success");
    return getAiGatewayUsage(user, {
      limit: Number.isFinite(limit) ? limit : 100,
      userId: url.searchParams.get("userId") ?? undefined,
      feature: url.searchParams.get("feature") ?? undefined,
      route: url.searchParams.get("route") ?? undefined,
      success:
        successParam === "true" ? true : successParam === "false" ? false : undefined,
      exportCsv: url.searchParams.get("export") === "csv",
    });
  }

  return getAiGatewayDashboard(user);
}

export async function PATCH(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = await getCurrentAuthUser();
  const body = (await request.json()) as Parameters<typeof patchAiGatewayConfig>[1];
  return patchAiGatewayConfig(user, body);
}

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = await getCurrentAuthUser();
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const body = (await request.json()) as Record<string, unknown>;

  switch (action) {
    case "provider":
      return upsertAiCloudProvider(user, body as Parameters<typeof upsertAiCloudProvider>[1]);
    case "user-grant":
      return upsertAiUserGrant(user, body as Parameters<typeof upsertAiUserGrant>[1]);
    case "fallback-test":
      return postAiGatewayFallbackTest(user);
    case "simulate":
      return postAiGatewaySimulate(user, body as Parameters<typeof postAiGatewaySimulate>[1]);
    default:
      return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = await getCurrentAuthUser();
  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");
  const userId = url.searchParams.get("userId");

  if (providerId) {
    return deleteAiCloudProvider(user, providerId);
  }
  if (userId) {
    return deleteAiUserGrant(user, userId);
  }

  return Response.json({ error: "providerId oder userId erforderlich." }, { status: 400 });
}
