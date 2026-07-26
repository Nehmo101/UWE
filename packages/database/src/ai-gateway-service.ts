import type { PrismaClient } from "./client";
import { prisma } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { resolveTokenEncryptionSecret } from "./token-crypto";

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
  // Defense-in-depth: personal_brain is permanently local-only, even if the
  // stored DB row was tampered with (PATCH already enforces this on write).
  rules.personal_brain = "CLOUD_FORBIDDEN";
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
    case "mail":
      return "private_notes";
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
        privacyRules: next.privacyRules,
        featureModels: next.featureModels as Prisma.InputJsonValue,
        dailyBudgetUsd: next.dailyBudgetUsd,
        monthlyBudgetUsd: next.monthlyBudgetUsd,
        perUserDailyBudgetUsd: next.perUserDailyBudgetUsd,
      },
      update: {
        routingMode: next.routingMode,
        cloudFallbackEnabled: next.cloudFallbackEnabled,
        privacyRules: next.privacyRules,
        featureModels: next.featureModels as Prisma.InputJsonValue,
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



  /**
   * Check whether a user may use AI for a given feature.
   * Master-admin (owner) and legacy DM/admin roles always allowed.
   */
  /**
   * Feature gate for AI requests. Per-user grants existed to ration cloud spend
   * and to hand out cloud access selectively; with the RTX host as the only
   * backend there is nothing to ration. Whoever can reach the app can use its
   * AI — the app itself is already behind the access gate.
   */
  async assertFeatureAccess(_input: {
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
  }


  /**
   * The RTX host is the only backend, so the config can only switch AI on or
   * off — there is no provider left to choose.
   */
  resolveProviderModeFromConfig(config: AiGatewayConfigRecord): "local_rtx" {
    if (config.routingMode === "DISABLED") {
      throw new AiGatewayDisabledError("KI ist systemweit deaktiviert.");
    }
    return "local_rtx";
  }
}

export function createAiGatewayService(db?: PrismaClient): AiGatewayService {
  return new AiGatewayService(db ?? prisma);
}
