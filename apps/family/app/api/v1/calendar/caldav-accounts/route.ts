import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyCalDavAccountService } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * CalDAV-Zugänge (iPhone-Kalender, lesen und schreiben) auflisten und anlegen.
 *
 * Wie bei den ICS-Abos steht der Klartext-Token ausschließlich in der Antwort
 * auf `POST` — danach ist er nicht mehr abrufbar, gespeichert wird nur sein
 * Hash. Deshalb eine Route und keine Server Action.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const rows = await createFamilyCalDavAccountService(familyPrisma).listAccounts();

  return NextResponse.json({
    accounts: rows.map((row) => ({
      id: row.id,
      label: row.label,
      tokenPrefix: row.tokenPrefix,
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  let body: { label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : "";
  const created = await createFamilyCalDavAccountService(familyPrisma).createAccount({ label });

  return NextResponse.json(
    {
      id: created.id,
      label: created.label,
      // Einmalig. Wer ihn verliert, legt einen neuen Zugang an.
      token: created.token,
    },
    { status: 201 },
  );
}
