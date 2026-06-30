import type { PrismaClient } from "./client";
import { createAuthService } from "./auth";
import { logAuditEvent } from "./audit-log-service";
import { pickUniqueSlug, slugifyPageTitle } from "./page-templates";

export interface CreateWorldRequest {
  name: string;
  slug?: string;
  description?: string | null;
  guestModeEnabled?: boolean;
  isSandbox?: boolean;
}

export interface CreatedWorldResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  guestModeEnabled: boolean;
  isSandbox: boolean;
}

export class WorldCreationService {
  constructor(private readonly db: PrismaClient) {}

  async createWorldForUser(
    userId: string,
    input: CreateWorldRequest,
  ): Promise<CreatedWorldResult> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("WORLD_NAME_REQUIRED");
    }

    const existingSlugs = (await this.db.world.findMany({ select: { slug: true } })).map(
      (world) => world.slug,
    );
    const baseSlug = (input.slug?.trim() || slugifyPageTitle(name)).slice(0, 80);
    const slug = pickUniqueSlug(baseSlug || "welt", existingSlugs);

    const world = await this.db.world.create({
      data: {
        name,
        slug,
        description: input.description?.trim() || null,
        guestModeEnabled: input.guestModeEnabled ?? false,
        isSandbox: input.isSandbox ?? false,
      },
    });

    const auth = createAuthService(this.db);
    await auth.createWorldMembership({
      userId,
      worldId: world.id,
      role: "owner",
    });

    await logAuditEvent(this.db, {
      actorUserId: userId,
      action: "content_created",
      targetType: "world",
      targetId: world.id,
      worldId: world.id,
      metadata: {
        slug: world.slug,
        guestModeEnabled: world.guestModeEnabled,
        isSandbox: world.isSandbox,
      },
    });

    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      description: world.description,
      guestModeEnabled: world.guestModeEnabled,
      isSandbox: world.isSandbox,
    };
  }
}

export function createWorldCreationService(db: PrismaClient): WorldCreationService {
  return new WorldCreationService(db);
}
