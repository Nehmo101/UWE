import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyMemberService, isFamilyMemberKind, resolveMemberColour } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Mitglieder des Haushalts lesen und anlegen.
 *
 * Konto-Verknüpfungen werden hier bewusst nicht vergeben: wer sich anmelden
 * darf, entscheidet allein das Häkchen in der Kommandozentrale. Von aussen
 * lassen sich nur Mitglieder *ohne* Konto anlegen.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const members = await createFamilyMemberService(familyPrisma).listMembers({
    includeInactive: url.searchParams.get("includeInactive") === "true",
  });

  return NextResponse.json({
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      kind: member.kind,
      colour: resolveMemberColour(member),
      hasAccount: member.userId !== null,
      isActive: member.isActive,
      birthdayOn: member.birthdayOn,
      anniversaryOn: member.anniversaryOn,
      note: member.note,
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  let body: { displayName?: unknown; kind?: unknown; note?: unknown; birthdayOn?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  if (typeof body.displayName !== "string" || body.displayName.trim() === "") {
    return NextResponse.json({ error: "displayName fehlt." }, { status: 400 });
  }

  const birthday = typeof body.birthdayOn === "string" ? new Date(body.birthdayOn) : null;

  try {
    const member = await createFamilyMemberService(familyPrisma).createMember({
      displayName: body.displayName,
      kind: isFamilyMemberKind(body.kind) ? body.kind : "adult",
      note: typeof body.note === "string" ? body.note : "",
      birthdayOn: birthday && !Number.isNaN(birthday.getTime()) ? birthday : null,
    });
    return NextResponse.json({ id: member.id, displayName: member.displayName }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Anlegen fehlgeschlagen." },
      { status: 400 },
    );
  }
}
