import type { EntityTagEntityType, Prisma, PrismaClient } from "./generated/prisma/client";
import { canonicalizeTag, normalizeTagKey } from "./tag-service";

export type { EntityTag, EntityTagEntityType, Tag } from "./generated/prisma/client";

export {
  EntityTagEntityType as EntityTagEntityTypeEnum,
} from "./generated/prisma/client";

export interface UpsertTagInput {
  key: string;
  label?: string;
  color?: string | null;
  description?: string | null;
}

export interface AttachEntityTagInput {
  tagKey: string;
  label?: string;
  entityType: EntityTagEntityType;
  entityId: string;
  worldId?: string | null;
}

/** Central tag row keyed by normalized tag key. */
export class EntityTagService {
  constructor(private readonly db: PrismaClient) {}

  async upsertTag(input: UpsertTagInput) {
    const key = normalizeTagKey(input.key);
    if (!key) {
      throw new Error("TAG_KEY_REQUIRED");
    }
    const label = input.label?.trim() || canonicalizeTag(input.key);
    return this.db.tag.upsert({
      where: { key },
      create: {
        key,
        label,
        color: input.color ?? null,
        description: input.description ?? null,
      },
      update: {
        label,
        color: input.color ?? undefined,
        description: input.description ?? undefined,
      },
    });
  }

  async attachTag(input: AttachEntityTagInput) {
    const tag = await this.upsertTag({ key: input.tagKey, label: input.label });
    return this.db.entityTag.upsert({
      where: {
        tagId_entityType_entityId: {
          tagId: tag.id,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: {
        tagId: tag.id,
        entityType: input.entityType,
        entityId: input.entityId,
        worldId: input.worldId ?? null,
      },
      update: {
        worldId: input.worldId ?? undefined,
      },
    });
  }

  async listTagsForEntity(entityType: EntityTagEntityType, entityId: string) {
    const links = await this.db.entityTag.findMany({
      where: { entityType, entityId },
      include: { tag: true },
      orderBy: { tag: { label: "asc" } },
    });
    return links.map((link) => link.tag);
  }

  async listEntityIdsByTagKey(
    tagKey: string,
    entityType: EntityTagEntityType,
    options?: { worldId?: string | null },
  ): Promise<string[]> {
    const key = normalizeTagKey(tagKey);
    const tag = await this.db.tag.findUnique({ where: { key } });
    if (!tag) return [];

    const rows = await this.db.entityTag.findMany({
      where: {
        tagId: tag.id,
        entityType,
        worldId: options?.worldId ?? undefined,
      },
      select: { entityId: true },
    });
    return rows.map((row) => row.entityId);
  }

  async detachTag(tagKey: string, entityType: EntityTagEntityType, entityId: string) {
    const key = normalizeTagKey(tagKey);
    const tag = await this.db.tag.findUnique({ where: { key } });
    if (!tag) return { count: 0 };

    return this.db.entityTag.deleteMany({
      where: { tagId: tag.id, entityType, entityId },
    });
  }

  async replaceEntityTags(
    entityType: EntityTagEntityType,
    entityId: string,
    tagKeys: string[],
    options?: { worldId?: string | null },
  ) {
    await this.db.entityTag.deleteMany({ where: { entityType, entityId } });
    const uniqueKeys = [...new Set(tagKeys.map(normalizeTagKey).filter(Boolean))];
    for (const key of uniqueKeys) {
      await this.attachTag({
        tagKey: key,
        entityType,
        entityId,
        worldId: options?.worldId,
      });
    }
  }
}

export function createEntityTagService(db: PrismaClient): EntityTagService {
  return new EntityTagService(db);
}

export type TagWithUsageCount = Prisma.TagGetPayload<{
  include: { _count: { select: { entityTags: true } } };
}>;
