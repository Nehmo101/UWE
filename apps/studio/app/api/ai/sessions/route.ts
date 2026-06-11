import { getSessions } from "../../../../src/lib/ai-handlers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldSlug = searchParams.get("worldSlug");
  const pageSlug = searchParams.get("pageSlug") ?? undefined;

  if (!worldSlug) {
    return Response.json({ error: "worldSlug ist erforderlich." }, { status: 400 });
  }

  try {
    return await getSessions(worldSlug, pageSlug);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sessions konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
