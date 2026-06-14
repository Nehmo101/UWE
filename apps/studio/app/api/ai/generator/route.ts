import { postGeneratorAction } from "@/src/lib/generator-handlers";
import type { GeneratorActionId } from "@uwe/database/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    actionId?: GeneratorActionId;
    worldSlug?: string;
    pageSlug?: string;
    useMock?: boolean;
    sync?: boolean;
  };

  return postGeneratorAction({
    actionId: body.actionId as GeneratorActionId,
    worldSlug: body.worldSlug ?? "",
    pageSlug: body.pageSlug ?? "",
    useMock: body.useMock,
    sync: body.sync,
  });
}
