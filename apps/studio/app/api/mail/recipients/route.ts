import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailRecipientService,
  prisma,
} from "@uwe/database/server";
import {
  guardStudioMutation,
  parseBody,
  parseQuery,
  passthroughBodySchema,
  requireStudioApiAuth,
  slugSchema,
} from "@uwe/security";
import { z } from "zod";

const mailRecipientsQuerySchema = z.object({
  worldSlug: slugSchema,
});

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, mailRecipientsQuerySchema);
  if (!parsed.success) return parsed.response;

  const recipients = createMailRecipientService(prisma);
  const [groups, players] = await Promise.all([
    recipients.listGroups(parsed.data.worldSlug),
    recipients.listWorldPlayerContacts(parsed.data.worldSlug),
  ]);

  const payload = { groups, players };
  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const payload = parsed.data as Record<string, unknown>;
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
