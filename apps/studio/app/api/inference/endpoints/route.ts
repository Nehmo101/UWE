import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createInferenceEndpointService,
  prisma,
} from "@uwe/database/server";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const service = createInferenceEndpointService(prisma);
  const endpoints = await service.list();
  return NextResponse.json({
    endpoints: endpoints.map((endpoint) => ({
      ...endpoint,
      lastProbeAt: endpoint.lastProbeAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  let body: { name?: string; baseUrl?: string; provider?: "ollama" | "openai_compatible" | "cloud"; apiKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  if (!body.name?.trim() || !body.baseUrl?.trim()) {
    return jsonError("name und baseUrl sind erforderlich.", 400);
  }

  try {
    const service = createInferenceEndpointService(prisma);
    const endpoint = await service.create({
      name: body.name,
      baseUrl: body.baseUrl,
      provider: body.provider,
      apiKey: body.apiKey,
    });
    return NextResponse.json({ endpoint });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erstellen fehlgeschlagen." },
      { status: 400 },
    );
  }
}
