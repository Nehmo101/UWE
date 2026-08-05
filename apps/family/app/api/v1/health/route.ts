import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyHealthService, isFamilyHealthRecordKind } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Gesundheits- und Tierarzt-Akte lesen und ergänzen.
 *
 * Ohne Parameter kommen die Fälligkeiten der nächsten sechs Monate — das ist
 * der Fall, für den man von aussen nachfragt.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const service = createFamilyHealthService(familyPrisma);
  const memberId = url.searchParams.get("memberId");

  if (memberId) {
    const records = await service.listForMember(memberId);
    return NextResponse.json({ records });
  }

  const now = new Date();
  const until = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const due = await service.listDueUntil(until, now);

  return NextResponse.json({
    due: due.map((record) => ({
      id: record.id,
      title: record.title,
      kind: record.kind,
      nextDueOn: record.nextDueOn,
      members: record.members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  let body: {
    memberId?: unknown;
    memberIds?: unknown;
    title?: unknown;
    kind?: unknown;
    nextDueOn?: unknown;
    notes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  // `memberId` bleibt als Einzelform gültig — Bestandsaufrufer schicken sie.
  const memberIds = [
    ...(Array.isArray(body.memberIds)
      ? body.memberIds.filter((id): id is string => typeof id === "string")
      : []),
    ...(typeof body.memberId === "string" ? [body.memberId] : []),
  ];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (memberIds.length === 0 || title === "") {
    return NextResponse.json({ error: "memberIds und title sind nötig." }, { status: 400 });
  }

  const nextDue = typeof body.nextDueOn === "string" ? new Date(body.nextDueOn) : null;

  const record = await createFamilyHealthService(familyPrisma).createRecord({
    memberIds,
    title,
    kind: isFamilyHealthRecordKind(body.kind) ? body.kind : "other",
    notes: typeof body.notes === "string" ? body.notes : "",
    nextDueOn: nextDue && !Number.isNaN(nextDue.getTime()) ? nextDue : null,
  });

  return NextResponse.json({ id: record.id, title: record.title }, { status: 201 });
}
