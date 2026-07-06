import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { assertPersonalBrainLocalOnly, prisma } from "@uwe/database/server";
import { loadStudioPersonalBrainPromptContext } from "@/src/lib/personal-brain-ai-context";

interface ContextBody {
  query?: string;
  limit?: number;
  /** Must be local_rtx — cloud is rejected to protect private data. */
  provider?: string;
}

function parseContextBody(body: ContextBody) {
  const query = body.query?.trim() ?? "";
  const limitRaw = body.limit ?? 12;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12;
  const provider = body.provider?.trim() || "local_rtx";
  return { query, limit, provider };
}

async function buildContext(query: string, limit: number) {
  return loadStudioPersonalBrainPromptContext(prisma, {
    query: query || undefined,
    retrievalLimit: limit,
    docFallbackLimit: limit,
    factFallbackLimit: limit,
  });
}

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const provider = searchParams.get("provider")?.trim() || "local_rtx";

  try {
    assertPersonalBrainLocalOnly(provider);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nur lokale KI erlaubt." },
      { status: 403 },
    );
  }

  const context = await buildContext(query, 12);
  return NextResponse.json({
    query,
    provider,
    localOnly: true,
    retrieval: Boolean(query),
    context,
    contextLength: context.length,
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  let body: ContextBody;
  try {
    body = (await request.json()) as ContextBody;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  const { query, limit, provider } = parseContextBody(body);

  try {
    assertPersonalBrainLocalOnly(provider);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nur lokale KI erlaubt." },
      { status: 403 },
    );
  }

  const context = await buildContext(query, limit);
  return NextResponse.json({
    query,
    provider,
    localOnly: true,
    retrieval: Boolean(query),
    context,
    contextLength: context.length,
  });
}
