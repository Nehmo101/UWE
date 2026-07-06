import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  extractOpen5eSpellDescription,
  extractOpen5eSpellLevel,
  extractOpen5eSpellSchool,
  resolveDndApiConfig,
} from "@uwe/database/server";
import { searchOpen5eSpells } from "@uwe/dnd-api";
import { dndSpellSearchQuerySchema, parseQuery } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
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
      school: extractOpen5eSpellSchool(item.raw),
      description: extractOpen5eSpellDescription(item.raw),
    })),
  });
}
