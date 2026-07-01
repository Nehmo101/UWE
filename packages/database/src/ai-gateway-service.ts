import type { PrismaClient } from "./client";
import { prisma } from "./client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

function parseOptionalPositiveInt(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveDailyTokenBudgetLimit(): number | null {
  return parseOptionalPositiveInt(process.env.AI_DAILY_TOKEN_BUDGET);
}

// --- Types ---

export type AiRoutingMode = "LOCAL_ONLY" | "LOCAL_THEN_CLOUD" | "CLOUD_ONLY" | "DISABLED";
export type AiPrivacyLevel = "CLOUD_ALLOWED" | "CLOUD_FORBIDDEN" | "LOCAL_REQUIRED";
export type AiFeatureCategory =
  | "general_chat"
  | "dnd_world"
  | "personal_brain"
  | "private_notes"
  | "admin_diagnostics"
  | "image_generation";

export type AiFeaturePermission =
  | "AI_CHAT_USE"
  | "AI_DND_USE"
  | "AI_IMAGE_USE"
  | "AI_SUMMARY_USE"
  | "AI_KNOWLEDGE_USE"
  | "AI_PROVIDER_MANAGE"
  | "AI_BUDGET_MANAGE"
  | "AI_PRIVACY_MANAGE"
  | "AI_USAGE_VIEW"
  | "AI_USER_GRANTS_MANAGE";

export const AI_FEATURE_PERMISSIONS: readonly AiFeaturePermission[] = [
  "AI_CHAT_USE",
  "AI_DND_USE",
  "AI_IMAGE_USE",
  "AI_SUMMARY_USE",
  "AI_KNOWLEDGE_USE",
  "AI_PROVIDER_MANAGE",
  "AI_BUDGET_MANAGE",
  "AI_PRIVACY_MANAGE",
  "AI_USAGE_VIEW",
  "AI_USER_GRANTS_MANAGE",
] as const;

export const AI_FEATURE_PERMISSION_LABELS: Record<AiFeaturePermission, string> = {
  AI_CHAT_USE: "KI-Chat nutzen",
  AI_DND_USE: "DnD-KI nutzen",
  AI_IMAGE_USE: "Bild-KI nutzen",
  AI_SUMMARY_USE: "Zusammenfassungen",
  AI_KNOWLEDGE_USE: "Wissens-KI nutzen",
  AI_PROVIDER_MANAGE: "Provider verwalten",
  AI_BUDGET_MANAGE: "Budgets verwalten",
  AI_PRIVACY_MANAGE: "Privacy-Regeln verwalten",
  AI_USAGE_VIEW: "Nutzungslogs einsehen",
  AI_USER_GRANTS_MANAGE: "User-Freigaben verwalten",
};

export const MASTER_ADMIN_PERMISSIONS: readonly AiFeaturePermission[] = [
  "AI_PROVIDER_MANAGE",
  "AI_BUDGET_MANAGE",
  "AI_PRIVACY_MANAGE",
  "AI_USAGE_VIEW",
  "AI_USER_GRANTS_MANAGE",
  "AI_CHAT_USE",
  "AI_DND_USE",
  "AI_IMAGE_USE",
  "AI_SUMMARY_USE",
  "AI_KNOWLEDGE_USE",
] as const;

export const DEFAULT_PRIVACY_RULES: Record<AiFeatureCategory, AiPrivacyLevel> = {
  general_chat: "CLOUD_ALLOWED",
  // DnD/world context may go to cloud when admin policy allows (RTX preferred, cloud fallback OK).
  // personal_brain remains hard local-only and cannot be changed via UI or API.
  dnd_world: "CLOUD_ALLOWED",
  personal_brain: "CLOUD_FORBIDDEN",
  private_notes: "CLOUD_FORBIDDEN",
  admin_diagnostics: "CLOUD_ALLOWED",
  image_generation: "CLOUD_ALLOWED",
};

/** Per-feature provider/model override. */
export interface AiFeatureModelConfig { providerId?: string | null; model?: string | null; }
export type AiFeatureModels = Partial<Record<AiFeatureCategory, AiFeatureModelConfig>>;
export const AI_FEATURE_MODEL_KEYS: readonly AiFeatureCategory[] = ["general_chat","dnd_world","personal_brain","private_notes","admin_diagnostics","image_generation"] as const;
export const AI_FEATURE_MODEL_LABELS: Record<AiFeatureCategory, string> = {
  general_chat: "Allgemeiner Chat", dnd_world: "DnD Generator / Brain / Welt", personal_brain: "Life Brain (persönlich)",
  private_notes: "Zusammenfassungen / Notizen", admin_diagnostics: "Admin-Diagnose", image_generation: "Image Studio",
};
export interface AiGatewayConfigRecord {
  routingMode: AiRoutingMode; cloudFallbackEnabled: boolean;
  privacyRules: Record<AiFeatureCategory, AiPrivacyLevel>; featureModels: AiFeatureModels;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  perUserDailyBudgetUsd: number | null;
  updatedAt: Date;
}

export interface AiCloudProviderRecord {
  id: string;
  providerId: string;
  label: string;
  baseUrl: string | null;
  defaultModel: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiUserGrantRecord {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  permissions: AiFeaturePermission[];
  cloudFallbackAllowed: boolean;
  dailyBudgetUsd: number | null;
  grantedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiUsageLogRecord {
  id: string;
  userId: string | null;
  userDisplayName: string | null;
  feature: string;
  taskType: string | null;
  provider: string;
  model: string;
  route: string;
  contextMode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface AiBudgetStatus {
  dailySpentUsd: number;
  monthlySpentUsd: number;
  userDailySpentUsd: number;
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  userDailyLimitUsd: number | null;
  dailySpentTokens: number;
  dailyTokenLimit: number | null;
  withinBudget: boolean;
  reason?: string;
}

export interface CreateUsageLogInput {
  userId?: string | null;
  feature: string;
  taskType?: string | null;
  provider: string;
  model: string;
  route: string;
  contextMode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  success?: boolean;
  errorMessage?: string | null;
  durationMs?: number | null;
}

export interface UpsertCloudProviderInput {
  providerId: string;
  label: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
  apiKey?: string | null;
  isEnabled?: boolean;
  priority?: number;
}

export interface UpsertUserGrantInput {
  userId: string;
  permissions: AiFeaturePermission[];
  cloudFallbackAllowed?: boolean;
  dailyBudgetUsd?: number | null;
  grantedBy?: string | null;
}

export class AiGatewayAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGatewayAccessDeniedError";
  }
}

export class AiGatewayBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGatewayBudgetExceededError";
  }
}

export class AiGatewayDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGatewayDisabledError";
  }
}

function parsePermissions(value: unknown): AiFeaturePermission[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is AiFeaturePermission =>
      typeof entry === "string" && AI_FEATURE_PERMISSIONS.includes(entry as AiFeaturePermission),
  );
}

function parsePrivacyRules(value: unknown): Record<AiFeatureCategory, AiPrivacyLevel> {
  const rules = { ...DEFAULT_PRIVACY_RULES };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return rules;
  }
  for (const [key, level] of Object.entries(value)) {
    if (
      key in rules &&
      (level === "CLOUD_ALLOWED" || level === "CLOUD_FORBIDDEN" || level === "LOCAL_REQUIRED")
    ) {
      rules[key as AiFeatureCategory] = level;
    }
  }
  return rules;
}
function parseFeatureModelEntry(value: unknown): AiFeatureModelConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const providerId = typeof record.providerId === "string" && record.providerId.trim() ? record.providerId.trim() : null;
  const model = typeof record.model === "string" && record.model.trim() ? record.model.trim() : null;
  if (!providerId && !model) return null;
  return { providerId, model };
}
function parseFeatureModels(value: unknown): AiFeatureModels {
  const models: AiFeatureModels = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return models;
  for (const key of AI_FEATURE_MODEL_KEYS) {
    const entry = parseFeatureModelEntry((value as Record<string, unknown>)[key]);
    if (entry) models[key] = entry;
  }
  return models;
}
export function resolveFeatureModelOverride(config: Pick<AiGatewayConfigRecord, "featureModels">, category: AiFeatureCategory): AiFeatureModelConfig | null {
  const override = config.featureModels[category];
  if (!override) return null;
  const providerId = override.providerId?.trim() || null;
  const model = override.model?.trim() || null;
  if (!providerId && !model) return null;
  return { providerId, model };
}
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Maps context mode / feature to privacy category. */
export function resolveFeatureCategory(input: {
  contextMode?: string;
  feature?: string;
  taskType?: string;
}): AiFeatureCategory {
  if (input.feature === "image_generation" || input.feature === "AI_IMAGE_USE") {
    return "image_generation";
  }
  if (input.feature === "admin_diagnostics") {
    return "admin_diagnostics";
  }
  switch (input.contextMode) {
    case "personal_brain":
      return "personal_brain";
    case "brain":
    case "current_object":
    case "current_object_plus_brain":
      return "dnd_world";
    case "general_chat":
      return "general_chat";
    default:
      if (input.taskType?.includes("image")) {
        return "image_generation";
      }
      if (input.taskType?.includes("summary") || input.feature === "AI_SUMMARY_USE") {
        return "private_notes";
      }
      return "dnd_world";
  }
}

/** Maps feature permission to required grant for non-master users. */
export function resolveRequiredPermission(input: {
  feature?: string;
  contextMode?: string;
  taskType?: string;
}): AiFeaturePermission {
  const category = resolveFeatureCategory(input);
  switch (category) {
    case "general_chat":
      return "AI_CHAT_USE";
    case "image_generation":
      return "AI_IMAGE_USE";
    case "personal_brain":
      return "AI_KNOWLEDGE_USE";
    case "admin_diagnostics":
      return "AI_CHAT_USE";
    default:
      if (input.taskType?.includes("summarize") || input.feature === "AI_SUMMARY_USE") {
        return "AI_SUMMARY_USE";
      }
      return "AI_DND_USE";
  }
}

export function isMasterAdminRole(role: string): boolean {
  return role === "owner";
}

export class AiGatewayService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async getConfig(): Promise<AiGatewayConfigRecord> {
    const row = await this.db.aiGatewayConfig.findUnique({ where: { id: "default" } });
    if (!row) {
      return {
        routingMode: "LOCAL_THEN_CLOUD",
        cloudFallbackEnabled: false,
        privacyRules: { ...DEFAULT_PRIVACY_RULES }, featureModels: {}, dailyBudgetUsd: null,
        monthlyBudgetUsd: null,
        perUserDailyBudgetUsd: null,
        updatedAt: new Date(),
      };
    }
    return {
      routingMode: row.routingMode as AiRoutingMode,
      cloudFallbackEnabled: row.cloudFallbackEnabled,
      privacyRules: parsePrivacyRules(row.privacyRules), featureModels: parseFeatureModels(row.featureModels), dailyBudgetUsd: row.dailyBudgetUsd,
      monthlyBudgetUsd: row.monthlyBudgetUsd,
      perUserDailyBudgetUsd: row.perUserDailyBudgetUsd,
      updatedAt: row.updatedAt,
    };
  }

  async updateConfig(input: Partial<Omit<AiGatewayConfigRecord, "updatedAt">>): Promise<AiGatewayConfigRecord> {
    const current = await this.getConfig();
    const next = {
      routingMode: input.routingMode ?? current.routingMode,
      cloudFallbackEnabled: input.cloudFallbackEnabled ?? current.cloudFallbackEnabled,
      privacyRules: input.privacyRules ?? current.privacyRules, featureModels: input.featureModels ?? current.featureModels, dailyBudgetUsd: input.dailyBudgetUsd !== undefined ? input.dailyBudgetUsd : current.dailyBudgetUsd,
      monthlyBudgetUsd:
        input.monthlyBudgetUsd !== undefined ? input.monthlyBudgetUsd : current.monthlyBudgetUsd,
      perUserDailyBudgetUsd:
        input.perUserDailyBudgetUsd !== undefined
          ? input.perUserDailyBudgetUsd
          : current.perUserDailyBudgetUsd,
    };

    const row = await this.db.aiGatewayConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        routingMode: next.routingMode,
        cloudFallbackEnabled: next.cloudFallbackEnabled,
        privacyRules: next.privacyRules, featureModels: next.featureModels, dailyBudgetUsd: next.dailyBudgetUsd,
        monthlyBudgetUsd: next.monthlyBudgetUsd,
        perUserDailyBudgetUsd: next.perUserDailyBudgetUsd,
      },
      update: {
        routingMode: next.routingMode,
        cloudFallbackEnabled: next.cloudFallbackEnabled,
        privacyRules: next.privacyRules,
        featureModels: next.featureModels,
        dailyBudgetUsd: next.dailyBudgetUsd,
        monthlyBudgetUsd: next.monthlyBudgetUsd,
        perUserDailyBudgetUsd: next.perUserDailyBudgetUsd,
      },
    });

    return {
      ...next,
      updatedAt: row.updatedAt,
    };
  }

  async listCloudProviders(): Promise<AiCloudProviderRecord[]> {
    const rows = await this.db.aiCloudProvider.findMany({
      orderBy: [{ priority: "desc" }, { label: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      providerId: row.providerId,
      label: row.label,
      baseUrl: row.baseUrl,
      defaultModel: row.defaultModel,
      hasApiKey: Boolean(row.apiKeyEnc),
      isEnabled: row.isEnabled,
      priority: row.priority,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertCloudProvider(input: UpsertCloudProviderInput): Promise<AiCloudProviderRecord> {
    const existing = await this.db.aiCloudProvider.findUnique({
      where: { providerId: input.providerId },
    });

    const apiKeyEnc =
      input.apiKey === null
        ? null
        : input.apiKey?.trim()
          ? encryptSecret(input.apiKey.trim(), this.encryptionSecret)
          : existing?.apiKeyEnc ?? null;

    const row = await this.db.aiCloudProvider.upsert({
      where: { providerId: input.providerId },
      create: {
        providerId: input.providerId,
        label: input.label.trim(),
        baseUrl: input.baseUrl?.trim() || null,
        defaultModel: input.defaultModel?.trim() || null,
        apiKeyEnc,
        isEnabled: input.isEnabled ?? true,
        priority: input.priority ?? 0,
      },
      update: {
        label: input.label.trim(),
        baseUrl: input.baseUrl?.trim() || null,
        defaultModel: input.defaultModel?.trim() || null,
        ...(input.apiKey !== undefined ? { apiKeyEnc } : {}),
        isEnabled: input.isEnabled ?? existing?.isEnabled ?? true,
        priority: input.priority ?? existing?.priority ?? 0,
      },
    });

    return {
      id: row.id,
      providerId: row.providerId,
      label: row.label,
      baseUrl: row.baseUrl,
      defaultModel: row.defaultModel,
      hasApiKey: Boolean(row.apiKeyEnc),
      isEnabled: row.isEnabled,
      priority: row.priority,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async deleteCloudProvider(providerId: string): Promise<boolean> {
    const result = await this.db.aiCloudProvider.deleteMany({ where: { providerId } });
    return result.count > 0;
  }

  /** Server-only: decrypt API key for inference. Never expose to client. */
  async resolveCloudProviderApiKey(providerId: string): Promise<string | null> {
    const row = await this.db.aiCloudProvider.findUnique({ where: { providerId } });
    if (!row?.apiKeyEnc || !row.isEnabled) {
      return null;
    }
    return decryptSecret(row.apiKeyEnc, this.encryptionSecret);
  }

  async listUserGrants(): Promise<AiUserGrantRecord[]> {
    const rows = await this.db.aiUserGrant.findMany({
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      displayName: row.user.displayName,
      email: row.user.email,
      permissions: parsePermissions(row.permissions),
      cloudFallbackAllowed: row.cloudFallbackAllowed,
      dailyBudgetUsd: row.dailyBudgetUsd,
      grantedBy: row.grantedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async getUserGrant(userId: string): Promise<AiUserGrantRecord | null> {
    const row = await this.db.aiUserGrant.findUnique({
      where: { userId },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      displayName: row.user.displayName,
      email: row.user.email,
      permissions: parsePermissions(row.permissions),
      cloudFallbackAllowed: row.cloudFallbackAllowed,
      dailyBudgetUsd: row.dailyBudgetUsd,
      grantedBy: row.grantedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async upsertUserGrant(input: UpsertUserGrantInput): Promise<AiUserGrantRecord> {
    const row = await this.db.aiUserGrant.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        permissions: input.permissions,
        cloudFallbackAllowed: input.cloudFallbackAllowed ?? false,
        dailyBudgetUsd: input.dailyBudgetUsd ?? null,
        grantedBy: input.grantedBy ?? null,
      },
      update: {
        permissions: input.permissions,
        cloudFallbackAllowed: input.cloudFallbackAllowed ?? false,
        dailyBudgetUsd: input.dailyBudgetUsd ?? null,
        grantedBy: input.grantedBy ?? null,
      },
      include: { user: { select: { displayName: true, email: true } } },
    });

    return {
      id: row.id,
      userId: row.userId,
      displayName: row.user.displayName,
      email: row.user.email,
      permissions: parsePermissions(row.permissions),
      cloudFallbackAllowed: row.cloudFallbackAllowed,
      dailyBudgetUsd: row.dailyBudgetUsd,
      grantedBy: row.grantedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async deleteUserGrant(userId: string): Promise<boolean> {
    const result = await this.db.aiUserGrant.deleteMany({ where: { userId } });
    return result.count > 0;
  }

  async logUsage(input: CreateUsageLogInput): Promise<void> {
    await this.db.aiUsageLog.create({
      data: {
        userId: input.userId ?? null,
        feature: input.feature,
        taskType: input.taskType ?? null,
        provider: input.provider,
        model: input.model,
        route: input.route,
        contextMode: input.contextMode ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        success: input.success ?? true,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
      },
    });
  }

  async listUsageLogs(options?: {
    userId?: string;
    feature?: string;
    route?: string;
    success?: boolean;
    limit?: number;
    since?: Date;
  }): Promise<AiUsageLogRecord[]> {
    const rows = await this.db.aiUsageLog.findMany({
      where: {
        ...(options?.userId ? { userId: options.userId } : {}),
        ...(options?.feature ? { feature: options.feature } : {}),
        ...(options?.route ? { route: options.route } : {}),
        ...(options?.success !== undefined ? { success: options.success } : {}),
        ...(options?.since ? { createdAt: { gte: options.since } } : {}),
      },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userDisplayName: row.user?.displayName ?? null,
      feature: row.feature,
      taskType: row.taskType,
      provider: row.provider,
      model: row.model,
      route: row.route,
      contextMode: row.contextMode,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostUsd: row.estimatedCostUsd,
      success: row.success,
      errorMessage: row.errorMessage,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    }));
  }

  async getBudgetStatus(userId?: string | null): Promise<AiBudgetStatus> {
    const config = await this.getConfig();
    const now = new Date();
    const dayStart = startOfDay(now);
    const monthStart = startOfMonth(now);

    const [dailyAgg, monthlyAgg, userDailyAgg, dailyTokenAgg] = await Promise.all([
      this.db.aiUsageLog.aggregate({
        where: { createdAt: { gte: dayStart }, success: true },
        _sum: { estimatedCostUsd: true },
      }),
      this.db.aiUsageLog.aggregate({
        where: { createdAt: { gte: monthStart }, success: true },
        _sum: { estimatedCostUsd: true },
      }),
      userId
        ? this.db.aiUsageLog.aggregate({
            where: { userId, createdAt: { gte: dayStart }, success: true },
            _sum: { estimatedCostUsd: true },
          })
        : Promise.resolve({ _sum: { estimatedCostUsd: null } }),
      this.db.aiUsageLog.aggregate({
        where: { createdAt: { gte: dayStart }, success: true },
        _sum: { inputTokens: true, outputTokens: true },
      }),
    ]);

    const dailySpentUsd = dailyAgg._sum.estimatedCostUsd ?? 0;
    const monthlySpentUsd = monthlyAgg._sum.estimatedCostUsd ?? 0;
    const userDailySpentUsd = userDailyAgg._sum.estimatedCostUsd ?? 0;
    const dailySpentTokens =
      (dailyTokenAgg._sum.inputTokens ?? 0) + (dailyTokenAgg._sum.outputTokens ?? 0);
    const dailyTokenLimit = resolveDailyTokenBudgetLimit();

    let userDailyLimitUsd = config.perUserDailyBudgetUsd;
    if (userId) {
      const grant = await this.getUserGrant(userId);
      if (grant?.dailyBudgetUsd != null) {
        userDailyLimitUsd = grant.dailyBudgetUsd;
      }
    }

    const status: AiBudgetStatus = {
      dailySpentUsd,
      monthlySpentUsd,
      userDailySpentUsd,
      dailyLimitUsd: config.dailyBudgetUsd,
      monthlyLimitUsd: config.monthlyBudgetUsd,
      userDailyLimitUsd,
      dailySpentTokens,
      dailyTokenLimit,
      withinBudget: true,
    };

    if (config.dailyBudgetUsd != null && dailySpentUsd >= config.dailyBudgetUsd) {
      status.withinBudget = false;
      status.reason = "Tagesbudget überschritten.";
    } else if (config.monthlyBudgetUsd != null && monthlySpentUsd >= config.monthlyBudgetUsd) {
      status.withinBudget = false;
      status.reason = "Monatsbudget überschritten.";
    } else if (userDailyLimitUsd != null && userDailySpentUsd >= userDailyLimitUsd) {
      status.withinBudget = false;
      status.reason = "User-Tagesbudget überschritten.";
    } else if (dailyTokenLimit != null && dailySpentTokens >= dailyTokenLimit) {
      status.withinBudget = false;
      status.reason = "Tages-Tokenbudget überschritten.";
    }

    return status;
  }

  async assertBudgetAvailable(userId?: string | null): Promise<void> {
    const status = await this.getBudgetStatus(userId);
    if (!status.withinBudget) {
      throw new AiGatewayBudgetExceededError(status.reason ?? "KI-Budget überschritten.");
    }
  }

  /**
   * Check whether a user may use AI for a given feature.
   * Master-admin (owner) and legacy DM/admin roles always allowed.
   */
  async assertFeatureAccess(input: {
    userId: string;
    role: string;
    feature?: string;
    contextMode?: string;
    taskType?: string;
  }): Promise<void> {
    const config = await this.getConfig();
    if (config.routingMode === "DISABLED") {
      throw new AiGatewayDisabledError("KI ist systemweit deaktiviert.");
    }

    if (isMasterAdminRole(input.role) || input.role === "admin" || input.role === "dm") {
      return;
    }

    const grant = await this.getUserGrant(input.userId);
    if (!grant) {
      throw new AiGatewayAccessDeniedError(
        "KI ist für diesen Benutzer nicht freigeschaltet. Bitte den Master-Admin kontaktieren.",
      );
    }

    const required = resolveRequiredPermission(input);
    if (!grant.permissions.includes(required)) {
      throw new AiGatewayAccessDeniedError(
        `Keine Freigabe für „${AI_FEATURE_PERMISSION_LABELS[required]}“.`,
      );
    }
  }

  /** Whether cloud fallback is allowed for this user and feature category. */
  async isCloudFallbackAllowed(input: {
    userId?: string | null;
    role: string;
    contextMode?: string;
    feature?: string;
    taskType?: string;
  }): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.cloudFallbackEnabled) {
      return false;
    }
    if (config.routingMode === "LOCAL_ONLY") {
      return false;
    }
    if (config.routingMode === "CLOUD_ONLY") {
      return true;
    }

    const category = resolveFeatureCategory(input);
    const privacy = config.privacyRules[category];
    if (privacy === "CLOUD_FORBIDDEN" || privacy === "LOCAL_REQUIRED") {
      return false;
    }

    if (isMasterAdminRole(input.role) || input.role === "admin" || input.role === "dm") {
      return true;
    }

    if (!input.userId) {
      return false;
    }

    const grant = await this.getUserGrant(input.userId);
    return grant?.cloudFallbackAllowed ?? false;
  }

  resolveProviderModeFromConfig(
    config: AiGatewayConfigRecord,
    requestedMode?: "auto" | "local_rtx" | "cloud",
  ): "auto" | "local_rtx" | "cloud" {
    if (config.routingMode === "DISABLED") {
      throw new AiGatewayDisabledError("KI ist systemweit deaktiviert.");
    }
    if (config.routingMode === "LOCAL_ONLY") {
      return "local_rtx";
    }
    if (config.routingMode === "CLOUD_ONLY") {
      return "cloud";
    }
    if (requestedMode === "cloud" && config.cloudFallbackEnabled) {
      return "cloud";
    }
    if (requestedMode === "local_rtx") {
      return "local_rtx";
    }
    return "auto";
  }
}

export function createAiGatewayService(db?: PrismaClient): AiGatewayService {
  return new AiGatewayService(db ?? prisma);
}
