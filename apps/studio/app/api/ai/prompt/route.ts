import { postAiPrompt } from "@/src/lib/ai-prompt-handlers";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import type { AiContextMode, AiProviderMode } from "@/src/lib/ai-prompt-ui";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    prompt?: string;
    providerMode?: AiProviderMode;
    contextMode?: AiContextMode;
    worldSlug?: string;
    pageSlug?: string;
    useMock?: boolean;
  };

  if (!body.prompt || !body.providerMode || !body.contextMode) {
    return Response.json(
      { error: "prompt, providerMode und contextMode sind erforderlich." },
      { status: 400 },
    );
  }

  return postAiPrompt({
    prompt: body.prompt,
    providerMode: body.providerMode,
    contextMode: body.contextMode,
    worldSlug: body.worldSlug,
    pageSlug: body.pageSlug,
    useMock: body.useMock,
  });
}
