import { getModels } from "../../../../src/lib/ai-handlers";
import type { AiProviderId } from "@uwe/ai-brain";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider") as AiProviderId | null;
  const useMock = searchParams.get("mock") === "true";

  if (!providerId) {
    return Response.json({ error: "provider query parameter required" }, { status: 400 });
  }

  try {
    return await getModels(providerId, useMock);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Modelle konnten nicht geladen werden." },
      { status: 502 },
    );
  }
}
