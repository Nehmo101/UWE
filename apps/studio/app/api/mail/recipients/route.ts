import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { brainPrisma } from "@uwe/database/brain-client";
import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailRecipientService,
  prisma,
} from "@uwe/database/server";
import { mailRecipientsBodySchema, parseBody, parseQuery, slugSchema } from "@uwe/security";
import { z } from "zod";

const mailRecipientsQuerySchema = z.object({
  worldSlug: slugSchema,
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, mailRecipientsQuerySchema);
  if (!parsed.success) return parsed.response;

  const recipients = createMailRecipientService(brainPrisma, prisma);
  const [groups, players] = await Promise.all([
    recipients.listGroups(parsed.data.worldSlug),
    recipients.listWorldPlayerContacts(parsed.data.worldSlug),
  ]);

  const payload = { groups, players };
  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailRecipientsBodySchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const recipients = createMailRecipientService(brainPrisma, prisma);

  if (body.action === "create_group") {
    const group = await recipients.createGroup(body.worldSlug, {
      name: body.name,
      description: body.description,
      slug: body.slug,
    });
    return NextResponse.json({ group }, { status: 201 });
  }

  if (body.action === "add_recipient") {
    const group = await recipients.addRecipient(body.worldSlug, body.groupSlug, {
      email: body.email,
      name: body.name,
      userId: body.userId,
    });
    return NextResponse.json({ group });
  }

  const group = await recipients.ensurePlayersGroup(body.worldSlug);
  return NextResponse.json({ group });
}
