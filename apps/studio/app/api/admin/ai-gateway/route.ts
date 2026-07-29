import { guardStudioAdminApiRequest } from "@/src/lib/studio-admin-auth";
import {
  getAiGatewayAccessStatus,
  getAiGatewayDashboard,
  getAiGatewayUsage,
  patchAiGatewayConfig,
  postAiGatewayFallbackTest,
} from "@/src/lib/ai-gateway-handlers";

export async function GET(request: Request) {
  const { error: authError, context } = await guardStudioAdminApiRequest(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = context.user;
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
  const { error: authError, context } = await guardStudioAdminApiRequest(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = context.user;
  const body = (await request.json()) as Parameters<typeof patchAiGatewayConfig>[1];
  return patchAiGatewayConfig(user, body);
}

export async function POST(request: Request) {
  const { error: authError, context } = await guardStudioAdminApiRequest(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = context.user;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const body = (await request.json()) as Record<string, unknown>;

  void body;

  switch (action) {
    case "fallback-test":
      return postAiGatewayFallbackTest(user);
    default:
      return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }
}
