import { NextResponse } from "next/server";
import { resolveDndApiConfig } from "@uwe/database/server";
import { searchEquipment, summarizeOpen5eEquipment, type Open5eEquipmentKind } from "@uwe/dnd-api";
import { dndEquipmentSearchQuerySchema, parseQuery, requireStudioApiAuth } from "@uwe/security";

function resolveOpen5eEquipmentKind(raw: unknown): Open5eEquipmentKind | null {
  if (typeof raw !== "object" || raw === null) return null;
  const kind = (raw as { equipmentKind?: unknown }).equipmentKind;
  return kind === "weapon" || kind === "magicitem" ? kind : null;
}

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, dndEquipmentSearchQuerySchema);
  if (!parsed.success) return parsed.response;

  const query = parsed.data.q?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const config = resolveDndApiConfig();
  const results = await searchEquipment(query, {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  });

  return NextResponse.json({
    results: results.map((item) => {
      const open5eKind = resolveOpen5eEquipmentKind(item.raw);
      const summary =
        item.summary ??
        (open5eKind ? summarizeOpen5eEquipment(open5eKind, item.raw) : undefined);

      return {
        id: item.id,
        name: item.name,
        url: item.url,
        provider: item.provider,
        kind: open5eKind ?? (item.provider === "dnd5e_srd" ? "equipment" : null),
        summary,
      };
    }),
  });
}
