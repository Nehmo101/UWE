import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const [templateCount, labelCount, worldCount] = await Promise.all([
    prisma.labelTemplate.count(),
    prisma.label.count(),
    prisma.world.count(),
  ]);

  const ok = templateCount > 0;
  return NextResponse.json({
    ok,
    message: ok
      ? `Label-System bereit: ${templateCount} Vorlagen, ${labelCount} Labels in ${worldCount} Welten.`
      : "Keine Label-Vorlagen gefunden — zuerst eine Welt anlegen und Labels erstellen.",
    templateCount,
    labelCount,
    worldCount,
    exportHint: "Druck über Browser (6×4 Zoll) oder PDF-Export pro Label — kein OS-Druckertreiber nötig.",
  });
}
