import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailRecipientService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;  const url = new URL(request.url);
  const worldSlug = url.searchParams.get("worldSlug")?.trim();

  if (!worldSlug) {
    return NextResponse.json({ error: "worldSlug erforderlich." }, { status: 400 });
  }

  const recipients = createMailRecipientService(prisma);
  const [groups, players] = await Promise.all([
    recipients.listGroups(worldSlug),
    recipients.listWorldPlayerContacts(worldSlug),
  ]);

  const payload = { groups, players };
  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}
export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request-Body muss ein JSON-Objekt sein." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const action = String(payload.action ?? "sync_players");
  const worldSlug = String(payload.worldSlug ?? "").trim();

  if (!worldSlug) {
    return NextResponse.json({ error: "worldSlug erforderlich." }, { status: 400 });
  }

  const recipients = createMailRecipientService(prisma);

  if (action === "sync_players") {
    const group = await recipients.ensurePlayersGroup(worldSlug);
    return NextResponse.json({ group });
  }

  if (action === "create_group") {
    const group = await recipients.createGroup(worldSlug, {
      name: String(payload.name ?? "").trim(),
      description: String(payload.description ?? ""),
      slug: payload.slug ? String(payload.slug) : undefined,
    });
    return NextResponse.json({ group }, { status: 201 });
  }

  if (action === "add_recipient") {
    const group = await recipients.addRecipient(worldSlug, String(payload.groupSlug ?? ""), {
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      userId: payload.userId ? String(payload.userId) : undefined,
    });
    return NextResponse.json({ group });
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
