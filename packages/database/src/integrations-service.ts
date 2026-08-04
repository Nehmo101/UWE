import {
  createEncounterPage,
  gatherEncounterCandidates,
  getOpen5eMonster,
  importOpen5eStatblockPage,
  listOpen5eMonstersByChallengeRating,
  searchAllDndApis,
  serializeEncounterComposition,
  suggestCandidateChallengeRatings,
  suggestEncounterComposition,
  type EncounterCandidate,
} from "@uwe/dnd-api";
import type {
  DndApiProvider,
  ImageStudioLinkTargetType,
  ImageStudioOperation,
  ImageStudioStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
import { buildPageUrl } from "./page-types";
import { slugifyPageTitle } from "./page-templates";
import type { UweRepository } from "./repository";

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
    // Kein Scraping, nur manuelle Referenz — die Regel gehört zur Domäne,
    // nicht in den Route-Handler.
    if (!input.url.includes("dndbeyond.com")) {
      throw new DndApiError("Nur D&D Beyond Links erlaubt — kein Scraping, nur manuelle Referenz.");
    }

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

  // --- Orchestrierung (früher inline in api/dnd-api/route.ts) ---------------
  //
  // Die Cache-Schlüssel-Politik lebt HIER, beim Cache: wer den Schlüssel
  // ändern will, ändert ihn an genau einer Stelle. Der Route-Handler ist nur
  // noch Guard + Zod + Dispatch.

  async getMonsterWithCache(slug: string, config: DndApiConfig) {
    const cacheKey = `monster:${slug}`;
    const cached = await this.getCached("open5e", cacheKey);
    if (cached) {
      return { data: cached, cached: true };
    }

    const data = await getOpen5eMonster(slug, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });
    await this.setCached("open5e", cacheKey, data, config.cacheTtlSeconds);
    return { data, cached: false };
  }

  async searchWithCache(query: string, config: DndApiConfig) {
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await this.getCached("open5e", cacheKey);
    if (cached && Array.isArray(cached)) {
      return { results: cached, cached: true };
    }

    const results = await searchAllDndApis(query, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });
    await this.setCached("open5e", cacheKey, results, config.cacheTtlSeconds);
    return { results, cached: false };
  }

  /** Holt den Statblock (gecacht) und legt die Monster-Seite an. */
  async importStatblock(
    repo: UweRepository,
    input: { worldId: string; worldSlug: string; slug: string; title?: string | null },
    config: DndApiConfig,
  ) {
    const monster = await getOpen5eMonster(input.slug, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });

    const page = await importOpen5eStatblockPage(repo, {
      worldId: input.worldId,
      worldSlug: input.worldSlug,
      open5eSlug: input.slug,
      title: input.title ?? undefined,
      monster,
      slugify: slugifyPageTitle,
    });

    return { page, editHref: `${buildPageUrl(input.worldSlug, page.type, page.slug)}/edit` };
  }

  /** Schlägt eine Begegnung vor — Kandidaten je Herausforderungsgrad gecacht. */
  async generateEncounter(
    input: {
      partyLevel: number;
      partySize: number;
      difficulty: "easy" | "medium" | "hard" | "deadly";
      style?: "boss" | "horde" | "mixed";
    },
    config: DndApiConfig,
  ) {
    if (!config.open5eEnabled) {
      throw new DndApiError("Open5e ist deaktiviert — Generator nicht verfügbar.");
    }

    const crBuckets = suggestCandidateChallengeRatings(
      input.partyLevel,
      input.partySize,
      input.difficulty,
    );

    const candidates = await gatherEncounterCandidates(crBuckets, async (cr) => {
      const cacheKey = `monsters-cr:${cr}`;
      const cached = await this.getCached("open5e", cacheKey);
      if (Array.isArray(cached)) {
        return cached as unknown as EncounterCandidate[];
      }
      const monsters = await listOpen5eMonstersByChallengeRating(cr, {
        open5eEnabled: config.open5eEnabled,
      });
      await this.setCached("open5e", cacheKey, monsters, config.cacheTtlSeconds);
      return monsters;
    });

    const composition = suggestEncounterComposition({
      partyLevel: input.partyLevel,
      partySize: input.partySize,
      difficulty: input.difficulty,
      style: input.style,
      candidates,
    });

    return serializeEncounterComposition(composition);
  }

  /** Legt eine Begegnungs-Seite aus einer manuellen Monsterliste an. */
  async createEncounter(
    repo: UweRepository,
    input: {
      worldId: string;
      worldSlug: string;
      title?: string | null;
      partyLevel?: number;
      partySize?: number;
      monsters: Array<{ name: string; cr?: string | null; slug: string; count?: number }>;
    },
  ) {
    const page = await createEncounterPage(repo, {
      worldId: input.worldId,
      worldSlug: input.worldSlug,
      title: input.title ?? undefined,
      partyLevel: input.partyLevel,
      partySize: input.partySize,
      // createEncounterPage kennt kein `null` für cr — hier normalisieren.
      monsters: input.monsters.map(({ cr, ...monster }) => ({
        ...monster,
        cr: cr ?? undefined,
      })),
      slugify: slugifyPageTitle,
    });

    return { page, editHref: `${buildPageUrl(input.worldSlug, page.type, page.slug)}/edit` };
  }
}

/** Domänenfehler des DnD-API-Service — die Nachricht ist nutzerzeigbar (400). */
export class DndApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DndApiError";
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
