import type {
  DndApiProvider,
  ImageStudioLinkTargetType,
  ImageStudioOperation,
  ImageStudioStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type {
  ImageStudioProject,
  ImageStudioVersion,
  ImageStudioLink,
  ImageStudioOperation,
  ImageStudioStatus,
  ImageStudioLinkTargetType,
  DndApiProvider,
  DndBeyondReference,
  DndApiCacheEntry,
} from "./generated/prisma/client";

export {
  ImageStudioOperation as ImageStudioOperationEnum,
  ImageStudioStatus as ImageStudioStatusEnum,
  ImageStudioLinkTargetType as ImageStudioLinkTargetTypeEnum,
  DndApiProvider as DndApiProviderEnum,
} from "./generated/prisma/client";

export const IMAGE_STUDIO_OPERATION_LABELS: Record<ImageStudioOperation, string> = {
  generate: "Generieren",
  edit: "Bearbeiten",
  inpaint: "Inpainting",
  remove_background: "Hintergrund entfernen",
  variant: "Variante",
};

export {
  IMAGE_STUDIO_STATUS_LABELS,
  imageStudioStatusBadgeClass,
} from "./integrations-ui";

export function extractImageStudioErrorMessage(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const lastError = (metadata as Record<string, unknown>).lastError;
  return typeof lastError === "string" && lastError.trim() ? lastError : null;
}

export interface CreateImageStudioProjectInput {
  worldId?: string | null;
  title: string;
  prompt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateImageStudioVersionInput {
  projectId: string;
  operation: ImageStudioOperation;
  prompt?: string | null;
  assetId?: string | null;
  parentVersionId?: string | null;
  providerMode?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class ImageStudioService {
  constructor(private readonly db: PrismaClient) {}

  async listProjects(worldId?: string, options?: { status?: ImageStudioStatus }) {
    return this.db.imageStudioProject.findMany({
      where: {
        ...(worldId ? { worldId } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        links: true,
      },
    });
  }

  async getProject(id: string) {
    return this.db.imageStudioProject.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        links: true,
      },
    });
  }

  async createProject(input: CreateImageStudioProjectInput) {
    return this.db.imageStudioProject.create({
      data: {
        worldId: input.worldId ?? null,
        title: input.title.trim(),
        prompt: input.prompt?.trim() || null,
        status: "draft",
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateProjectStatus(id: string, status: ImageStudioStatus) {
    return this.db.imageStudioProject.update({
      where: { id },
      data: { status },
    });
  }

  async markProjectFailed(id: string, errorMessage?: string) {
    const existing = await this.db.imageStudioProject.findUnique({
      where: { id },
      select: { metadata: true },
    });
    const prior =
      existing?.metadata &&
      typeof existing.metadata === "object" &&
      !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    return this.db.imageStudioProject.update({
      where: { id },
      data: {
        status: "failed",
        metadata: toPrismaJsonValue({
          ...prior,
          lastError: (errorMessage?.trim() || "Unbekannter Fehler").slice(0, 500),
          failedAt: new Date().toISOString(),
        }),
      },
    });
  }

  async addVersion(input: CreateImageStudioVersionInput) {
    const last = await this.db.imageStudioVersion.findFirst({
      where: { projectId: input.projectId },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    return this.db.imageStudioVersion.create({
      data: {
        projectId: input.projectId,
        versionNumber,
        operation: input.operation,
        prompt: input.prompt?.trim() || null,
        assetId: input.assetId ?? null,
        parentVersionId: input.parentVersionId ?? null,
        providerMode: input.providerMode ?? null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async linkProject(
    projectId: string,
    targetType: ImageStudioLinkTargetType,
    targetId: string,
  ) {
    return this.db.imageStudioLink.upsert({
      where: {
        projectId_targetType_targetId: { projectId, targetType, targetId },
      },
      create: { projectId, targetType, targetId },
      update: {},
    });
  }

  async unlinkProject(
    projectId: string,
    targetType: ImageStudioLinkTargetType,
    targetId: string,
  ) {
    await this.db.imageStudioLink.deleteMany({
      where: { projectId, targetType, targetId },
    });
  }

  async saveDraft(input: {
    projectId: string;
    prompt?: string | null;
    title?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.db.imageStudioProject.update({
      where: { id: input.projectId },
      data: {
        status: "draft",
        prompt: input.prompt?.trim() || undefined,
        title: input.title?.trim() || undefined,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getLatestVersion(projectId: string) {
    return this.db.imageStudioVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
      include: { asset: true },
    });
  }
}

export function createImageStudioService(db: PrismaClient): ImageStudioService {
  return new ImageStudioService(db);
}

export class DndApiService {
  constructor(private readonly db: PrismaClient) {}

  async getCached(provider: DndApiProvider, cacheKey: string) {
    const entry = await this.db.dndApiCacheEntry.findUnique({
      where: { provider_cacheKey: { provider, cacheKey } },
    });
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      await this.db.dndApiCacheEntry.delete({ where: { id: entry.id } });
      return null;
    }
    return entry.payload;
  }

  async setCached(
    provider: DndApiProvider,
    cacheKey: string,
    payload: unknown,
    ttlSeconds = 86400,
  ) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return this.db.dndApiCacheEntry.upsert({
      where: { provider_cacheKey: { provider, cacheKey } },
      create: {
        provider,
        cacheKey,
        payload: toPrismaJsonValue(payload)!,
        expiresAt,
      },
      update: {
        payload: toPrismaJsonValue(payload)!,
        expiresAt,
      },
    });
  }

  async listBeyondReferences(worldId: string) {
    return this.db.dndBeyondReference.findMany({
      where: { worldId },
      orderBy: { title: "asc" },
      include: { page: { select: { id: true, title: true, slug: true, type: true } } },
    });
  }

  async createBeyondReference(input: {
    worldId: string;
    pageId?: string | null;
    title: string;
    url: string;
    entityType?: string | null;
    notes?: string | null;
  }) {
    return this.db.dndBeyondReference.create({
      data: {
        worldId: input.worldId,
        pageId: input.pageId ?? null,
        title: input.title.trim(),
        url: input.url.trim(),
        entityType: input.entityType?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  }

  async deleteBeyondReference(id: string) {
    await this.db.dndBeyondReference.delete({ where: { id } });
  }
}

export function createDndApiService(db: PrismaClient): DndApiService {
  return new DndApiService(db);
}

export interface DndApiConfig {
  open5eEnabled: boolean;
  dnd5eSrdEnabled: boolean;
  cacheTtlSeconds: number;
}

export function resolveDndApiConfig(env: NodeJS.ProcessEnv = process.env): DndApiConfig {
  return {
    open5eEnabled: env.DND_OPEN5E_ENABLED !== "false",
    dnd5eSrdEnabled: env.DND_SRD_API_ENABLED !== "false",
    cacheTtlSeconds: Number(env.DND_API_CACHE_TTL_SECONDS ?? "86400"),
  };
}

/**
 * Image Studio kennt seit N.3 nur noch einen Weg: den Maschinenraum-Host über die
 * outbound Connector-Queue. Der Anbieter-Modus und das Cloud-Zubehör
 * (`allowCloud`, API-Key) sind ersatzlos entfallen — was bleibt, ist an/aus und
 * ob der Hintergrund-Entferner benutzt werden darf.
 */
export interface ImageStudioConfig {
  enabled: boolean;
  backgroundRemovalEnabled: boolean;
}

export interface ImageStudioConfigStatus extends ImageStudioConfig {
  engineAgentConfigured: boolean;
  /** Bildgenerierung läuft über die outbound Maschinenraum-Queue. */
  connectorImageEnabled: boolean;
  localImageBackendReady: boolean;
  source: "portal" | "env";
  message: string;
}

export interface ImageStudioPortalOverrides {
  enabled?: boolean;
  backgroundRemovalEnabled?: boolean;
}

function resolveEnvImageStudioConfig(env: NodeJS.ProcessEnv): ImageStudioConfig {
  return {
    enabled: env.IMAGE_STUDIO_ENABLED !== "false",
    backgroundRemovalEnabled: env.IMAGE_STUDIO_BG_REMOVAL !== "false",
  };
}

export function resolveImageStudioConfig(
  env: NodeJS.ProcessEnv = process.env,
  portal?: ImageStudioPortalOverrides | null,
): ImageStudioConfig {
  const envConfig = resolveEnvImageStudioConfig(env);
  if (!portal) {
    return envConfig;
  }

  return {
    enabled: portal.enabled ?? envConfig.enabled,
    backgroundRemovalEnabled:
      portal.backgroundRemovalEnabled ?? envConfig.backgroundRemovalEnabled,
  };
}

export function resolveImageStudioConfigStatus(
  env: NodeJS.ProcessEnv = process.env,
  portal?: ImageStudioPortalOverrides | null,
): ImageStudioConfigStatus {
  const config = resolveImageStudioConfig(env, portal);
  const engineAgentConfigured = Boolean(env.ENGINE_BASE_URL?.trim());
  const connectorImageEnabled = env.ENGINE_USE_CONNECTOR_IMAGE !== "false";
  const fromPortal = portal !== undefined && portal !== null;

  let message = fromPortal
    ? "Portal-Einstellungen aktiv — ENV-Werte als Fallback."
    : "Konfiguration aus Umgebungsvariablen.";
  if (!config.enabled) {
    message = "Image Studio ist deaktiviert.";
  } else if (!connectorImageEnabled) {
    message =
      "Kein Bild-Backend: die Maschinenraum-Queue ist abgeschaltet (ENGINE_USE_CONNECTOR_IMAGE=false).";
  } else {
    message =
      "Bildgenerierung über Maschinenraum (image_generate) — der Connector muss image_generation anbieten.";
  }

  return {
    ...config,
    engineAgentConfigured,
    connectorImageEnabled,
    localImageBackendReady: connectorImageEnabled,
    source: fromPortal ? "portal" : "env",
    message,
  };
}

export interface CalendarIntegrationConfig {
  enabled: boolean;
  caldavEnabled: boolean;
  familywallEnabled: boolean;
  defaultTimezone: string;
}

export function resolveCalendarConfig(env: NodeJS.ProcessEnv = process.env): CalendarIntegrationConfig {
  return {
    enabled: env.CALENDAR_ENABLED !== "false",
    caldavEnabled: env.CALENDAR_CALDAV_ENABLED === "true",
    familywallEnabled: env.CALENDAR_FAMILYWALL_ENABLED !== "false",
    defaultTimezone: env.CALENDAR_DEFAULT_TIMEZONE?.trim() || "Europe/Berlin",
  };
}
