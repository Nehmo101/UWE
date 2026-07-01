import type { WorldMemberRole } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type { UserRole } from "./generated/prisma/client";

export interface ResolvedUser {
  id: string;
  displayName: string;
  email: string | null;
}

export interface ResolvedWorld {
  id: string;
  name: string;
  slug: string;
}

export type EntityResolveResult<T> =
  | { ok: true; entity: T }
  | { ok: false; code: "not_found" | "ambiguous"; candidates: Array<{ id: string; label: string }> };

const WORLD_MEMBER_ROLE_ALIASES: Record<string, WorldMemberRole> = {
  player: "player",
  spieler: "player",
  spielerin: "player",
  spielerinnen: "player",
  spielern: "player",
  dm: "dm",
  co_dm: "co_dm",
  "co-dm": "co_dm",
  codm: "co_dm",
  co: "co_dm",
  owner: "owner",
  besitzer: "owner",
  weltbesitzer: "owner",
};

const USER_ROLE_ALIASES: Record<string, UserRole> = {
  player: "player",
  spieler: "player",
  spielerin: "player",
  dm: "dm",
  admin: "admin",
  owner: "owner",
  readonly: "readonly",
  guest: "guest",
  gast: "guest",
};

export function parseWorldMemberRoleToken(token: string): WorldMemberRole | null {
  const normalized = token.trim().toLowerCase().replace(/\s+/g, "_");
  return WORLD_MEMBER_ROLE_ALIASES[normalized] ?? null;
}

export function parseUserRoleToken(token: string): UserRole | null {
  const normalized = token.trim().toLowerCase();
  return USER_ROLE_ALIASES[normalized] ?? null;
}

export function worldMemberRoleLabel(role: WorldMemberRole): string {
  switch (role) {
    case "player":
      return "Spieler";
    case "dm":
      return "DM";
    case "co_dm":
      return "Co-DM";
    case "owner":
      return "Welt-Besitzer";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/^["']|["']$/g, "");
}

export async function resolveUserQuery(
  db: PrismaClient,
  query: string,
): Promise<EntityResolveResult<ResolvedUser>> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return { ok: false, code: "not_found", candidates: [] };
  }

  if (normalized.includes("@")) {
    const user = await db.user.findUnique({
      where: { email: normalized.toLowerCase() },
      select: { id: true, displayName: true, email: true },
    });
    if (!user) {
      return { ok: false, code: "not_found", candidates: [] };
    }
    return { ok: true, entity: user };
  }

  const exact = await db.user.findMany({
    where: { displayName: { equals: normalized } },
    select: { id: true, displayName: true, email: true },
    take: 5,
  });
  if (exact.length === 1) {
    return { ok: true, entity: exact[0]! };
  }
  if (exact.length > 1) {
    return {
      ok: false,
      code: "ambiguous",
      candidates: exact.map((user) => ({
        id: user.id,
        label: `${user.displayName}${user.email ? ` (${user.email})` : ""}`,
      })),
    };
  }

  const partial = await db.user.findMany({
    where: { displayName: { contains: normalized } },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
    take: 10,
  });
  if (partial.length === 1) {
    return { ok: true, entity: partial[0]! };
  }
  if (partial.length === 0) {
    return { ok: false, code: "not_found", candidates: [] };
  }
  return {
    ok: false,
    code: "ambiguous",
    candidates: partial.map((user) => ({
      id: user.id,
      label: `${user.displayName}${user.email ? ` (${user.email})` : ""}`,
    })),
  };
}

export async function resolveWorldQuery(
  db: PrismaClient,
  query: string,
): Promise<EntityResolveResult<ResolvedWorld>> {
  const normalized = normalizeQuery(query).toLowerCase();
  if (!normalized) {
    return { ok: false, code: "not_found", candidates: [] };
  }

  const bySlug = await db.world.findUnique({
    where: { slug: normalized },
    select: { id: true, name: true, slug: true },
  });
  if (bySlug) {
    return { ok: true, entity: bySlug };
  }

  const exactName = await db.world.findMany({
    where: { name: { equals: normalized } },
    select: { id: true, name: true, slug: true },
    take: 5,
  });
  if (exactName.length === 1) {
    return { ok: true, entity: exactName[0]! };
  }
  if (exactName.length > 1) {
    return {
      ok: false,
      code: "ambiguous",
      candidates: exactName.map((world) => ({
        id: world.id,
        label: `${world.name} (${world.slug})`,
      })),
    };
  }

  const partial = await db.world.findMany({
    where: {
      OR: [
        { name: { contains: normalized } },
        { slug: { contains: normalized } },
      ],
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  if (partial.length === 1) {
    return { ok: true, entity: partial[0]! };
  }
  if (partial.length === 0) {
    return { ok: false, code: "not_found", candidates: [] };
  }
  return {
    ok: false,
    code: "ambiguous",
    candidates: partial.map((world) => ({
      id: world.id,
      label: `${world.name} (${world.slug})`,
    })),
  };
}

export function formatEntityResolveError(
  entityLabel: string,
  result: Extract<EntityResolveResult<unknown>, { ok: false }>,
): string {
  if (result.code === "not_found") {
    return `${entityLabel} nicht gefunden.`;
  }
  const labels = result.candidates.map((candidate) => candidate.label).join(", ");
  return `${entityLabel} mehrdeutig — bitte präzisieren (E-Mail oder eindeutiger Name). Kandidaten: ${labels}.`;
}
