import { NextResponse } from "next/server";
import { extractOpen5eSpellLevel, resolveDndApiConfig } from "@uwe/database/server";
import { searchOpen5eSpells } from "@uwe/dnd-api";
import { dndSpellSearchQuerySchema, parseQuery, requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, dndSpellSearchQuerySchema);
  if (!parsed.success) return parsed.response;

  const query = parsed.data.q?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const config = resolveDndApiConfig();
  const results = await searchOpen5eSpells(query, {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  });

  return NextResponse.json({
    results: results.map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      spellLevel: extractOpen5eSpellLevel(item.raw),
    })),
  });
}
