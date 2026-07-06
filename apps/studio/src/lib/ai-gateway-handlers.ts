import { NextResponse } from "next/server";
import {
  createAiGatewayService,
  createUweRepository,
  logAuditEvent,
  prisma,
  type AiFeaturePermission,
  type AiRoutingMode,
  type AiPrivacyLevel,
  type AiFeatureCategory,
} from "@uwe/database/server";
import {
  getAiGatewayStatusForClient,
  runAiGatewayFallbackTest,
  checkRtxReadiness,
  simulateGatewayRouting,
} from "@uwe/ai-brain";
import type { AuthUser } from "@uwe/auth";
import { jsonError } from "./api-response";

function gatewayService() {
  return createAiGatewayService(prisma);
}

function requireMasterAdmin(user: AuthUser | null): NextResponse | null {
  if (!user || user.role !== "owner") {
    return jsonError("Nur der Master-Admin (Owner) darf KI-Gateway-Einstellungen verwalten.", 403);
  }
  return null;
}

async function auditGatewayChange(
  user: AuthUser,
  action: "content_updated",
  metadata: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent(prisma, {
    action,
    targetType: "settings",
    targetId: "ai-gateway",
    actorUserId: user.id,
    metadata,
  });
}

export async function getAiGatewayDashboard(_user: AuthUser | null) {
  const denied = requireMasterAdmin(_user);
  if (denied) return denied;

  const service = gatewayService();
  const [status, grants, usageLogs] = await Promise.all([
    getAiGatewayStatusForClient(service),
    service.listUserGrants(),
    service.listUsageLogs({ limit: 50 }),
  ]);

  return NextResponse.json({
    ...status,
    userGrants: grants,
    recentUsage: usageLogs.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}

export async function patchAiGatewayConfig(
  user: AuthUser | null,
  body: {
    routingMode?: AiRoutingMode;
    cloudFallbackEnabled?: boolean;
    privacyRules?: Partial<Record<AiFeatureCategory, AiPrivacyLevel>>;
    featureModels?: Partial<Record<AiFeatureCategory, { providerId?: string | null; model?: string | null } | null>>;
    dailyBudgetUsd?: number | null;
    monthlyBudgetUsd?: number | null;
    perUserDailyBudgetUsd?: number | null;
  },
) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  // personal_brain is permanently local-only — reject any attempt to change it.
  if (body.privacyRules?.personal_brain !== undefined && body.privacyRules.personal_brain !== "CLOUD_FORBIDDEN") {
    return jsonError(
      "personal_brain kann nicht auf Cloud gesetzt werden — Life-Brain ist permanent lokal-only.",
      400,
    );
  }

  if (body.featureModels?.personal_brain?.providerId && body.featureModels.personal_brain.providerId !== "local_rtx") {
    return jsonError("personal_brain darf keinen Cloud-Provider nutzen — Life-Brain ist permanent lokal-only.", 400);
  }
  const service = gatewayService();
  const current = await service.getConfig();
  const mergedPrivacyRules = body.privacyRules
    ? { ...current.privacyRules, ...body.privacyRules, personal_brain: "CLOUD_FORBIDDEN" as AiPrivacyLevel }
    : current.privacyRules;
  let mergedFeatureModels = current.featureModels;
  if (body.featureModels) {
    mergedFeatureModels = { ...current.featureModels };
    for (const [key, value] of Object.entries(body.featureModels)) {
      const category = key as AiFeatureCategory;
      if (value === null || (!value?.providerId?.trim() && !value?.model?.trim())) {
        delete mergedFeatureModels[category];
      } else {
        mergedFeatureModels[category] = {
          providerId: value.providerId?.trim() || null,
          model: value.model?.trim() || null,
        };
      }
    }
  }
  const config = await service.updateConfig({
    routingMode: body.routingMode ?? current.routingMode,
    cloudFallbackEnabled: body.cloudFallbackEnabled ?? current.cloudFallbackEnabled,
    privacyRules: mergedPrivacyRules, featureModels: mergedFeatureModels, dailyBudgetUsd: body.dailyBudgetUsd !== undefined ? body.dailyBudgetUsd : current.dailyBudgetUsd,
    monthlyBudgetUsd:
      body.monthlyBudgetUsd !== undefined ? body.monthlyBudgetUsd : current.monthlyBudgetUsd,
    perUserDailyBudgetUsd:
      body.perUserDailyBudgetUsd !== undefined
        ? body.perUserDailyBudgetUsd
        : current.perUserDailyBudgetUsd,
  });

  if (user) {
    await auditGatewayChange(user, "content_updated", {
      kind: "ai_gateway_config",
      routingMode: config.routingMode,
      cloudFallbackEnabled: config.cloudFallbackEnabled,
      privacyRulesChanged: Boolean(body.privacyRules), featureModelsChanged: Boolean(body.featureModels), budgetsChanged:
        body.dailyBudgetUsd !== undefined ||
        body.monthlyBudgetUsd !== undefined ||
        body.perUserDailyBudgetUsd !== undefined,
    });
  }

  return NextResponse.json({
    config: { ...config, updatedAt: config.updatedAt.toISOString() },
  });
}

export async function upsertAiCloudProvider(
  user: AuthUser | null,
  body: {
    providerId: string;
    label: string;
    baseUrl?: string | null;
    defaultModel?: string | null;
    apiKey?: string | null;
    isEnabled?: boolean;
    priority?: number;
  },
) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  if (!body.providerId?.trim() || !body.label?.trim()) {
    return jsonError("providerId und label sind erforderlich.", 400);
  }

  const provider = await gatewayService().upsertCloudProvider({
    providerId: body.providerId.trim(),
    label: body.label.trim(),
    baseUrl: body.baseUrl,
    defaultModel: body.defaultModel,
    apiKey: body.apiKey,
    isEnabled: body.isEnabled,
    priority: body.priority,
  });

  if (user) {
    await auditGatewayChange(user, "content_updated", {
      kind: "ai_cloud_provider",
      providerId: provider.providerId,
      hasApiKey: provider.hasApiKey,
      apiKeyUpdated: body.apiKey !== undefined,
    });
  }

  return NextResponse.json({ provider });
}

export async function deleteAiCloudProvider(user: AuthUser | null, providerId: string) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  const deleted = await gatewayService().deleteCloudProvider(providerId);
  if (!deleted) {
    return jsonError("Provider nicht gefunden.", 404);
  }
  return NextResponse.json({ ok: true });
}

export async function upsertAiUserGrant(
  user: AuthUser | null,
  body: {
    userId: string;
    permissions: AiFeaturePermission[];
    cloudFallbackAllowed?: boolean;
    dailyBudgetUsd?: number | null;
  },
) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  if (!body.userId?.trim()) {
    return jsonError("userId ist erforderlich.", 400);
  }

  const grant = await gatewayService().upsertUserGrant({
    userId: body.userId.trim(),
    permissions: body.permissions ?? [],
    cloudFallbackAllowed: body.cloudFallbackAllowed ?? false,
    dailyBudgetUsd: body.dailyBudgetUsd ?? null,
    grantedBy: user?.id ?? null,
  });

  if (user) {
    await auditGatewayChange(user, "content_updated", {
      kind: "ai_user_grant",
      userId: grant.userId,
      permissions: grant.permissions,
      cloudFallbackAllowed: grant.cloudFallbackAllowed,
    });
  }

  return NextResponse.json({ grant });
}

export async function deleteAiUserGrant(user: AuthUser | null, userId: string) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  const deleted = await gatewayService().deleteUserGrant(userId);
  if (!deleted) {
    return jsonError("Freigabe nicht gefunden.", 404);
  }
  return NextResponse.json({ ok: true });
}

export async function postAiGatewayFallbackTest(user: AuthUser | null) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  if (!user) {
    return jsonError("Authentifizierung erforderlich.", 401);
  }

  const repo = createUweRepository();
  const result = await runAiGatewayFallbackTest(
    { repo },
    { userId: user.id, role: user.role },
  );

  const rtxHealth = await checkRtxReadiness({ prisma });

  return NextResponse.json({
    ...result,
    rtxHealth,
  });
}

export async function postAiGatewaySimulate(
  user: AuthUser | null,
  body: {
    simulateRtxOffline?: boolean;
    userId?: string;
    privacyFeature?: AiFeatureCategory;
  } = {},
) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  const service = gatewayService();
  const status = await getAiGatewayStatusForClient(service);
  const privacyFeature = body.privacyFeature ?? "general_chat";
  const privacyLevel =
    status.config.privacyRules[privacyFeature] ??
    status.config.privacyRules.general_chat;

  let userCloudFallbackEnabled = false;
  if (body.userId) {
    const grant = await service.getUserGrant(body.userId);
    userCloudFallbackEnabled = grant?.cloudFallbackAllowed ?? false;
  }

  const cases = simulateGatewayRouting({
    config: {
      ...status.config,
      updatedAt: new Date(status.config.updatedAt),
    },
    rtxOnline: status.rtxHealth.ready,
    cloudProviders: status.providers.map((provider) => ({
      label: provider.label,
      hasApiKey: provider.hasApiKey,
      isEnabled: provider.isEnabled,
    })),
    budgetWithinLimit: status.budget.withinBudget,
    privacyFeature,
    privacyLevel,
    userCloudFallbackEnabled,
    simulateRtxOffline: body.simulateRtxOffline ?? !status.rtxHealth.ready,
  });

  return NextResponse.json({ cases });
}

export async function getAiGatewayUsage(
  user: AuthUser | null,
  options: {
    limit?: number;
    userId?: string;
    feature?: string;
    route?: string;
    success?: boolean;
    exportCsv?: boolean;
  } = {},
) {
  const denied = requireMasterAdmin(user);
  if (denied) return denied;

  const limit = options.limit ?? 100;
  const logs = await gatewayService().listUsageLogs({
    limit,
    userId: options.userId,
    feature: options.feature,
    route: options.route,
    success: options.success,
  });

  if (options.exportCsv) {
    const header = "createdAt,userDisplayName,feature,taskType,provider,model,route,success,inputTokens,outputTokens,estimatedCostUsd\n";
    const rows = logs.map((entry) =>
      [
        entry.createdAt.toISOString(),
        JSON.stringify(entry.userDisplayName ?? ""),
        JSON.stringify(entry.feature),
        JSON.stringify(entry.taskType ?? ""),
        JSON.stringify(entry.provider),
        JSON.stringify(entry.model),
        JSON.stringify(entry.route),
        entry.success,
        entry.inputTokens ?? "",
        entry.outputTokens ?? "",
        entry.estimatedCostUsd ?? "",
      ].join(","),
    );
    return new NextResponse(header + rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ai-usage-logs.csv"',
      },
    });
  }

  return NextResponse.json({
    logs: logs.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}

/** Non-admin: check if current user has AI access (for UI gating). */
export async function getAiGatewayAccessStatus(user: AuthUser | null) {
  if (!user) {
    return NextResponse.json({ allowed: false, reason: "Nicht angemeldet." });
  }

  const service = gatewayService();
  const config = await service.getConfig();

  if (config.routingMode === "DISABLED") {
    return NextResponse.json({ allowed: false, reason: "KI ist systemweit deaktiviert." });
  }

  if (user.role === "owner" || user.role === "admin" || user.role === "dm") {
    return NextResponse.json({ allowed: true, role: user.role, grant: null });
  }

  const grant = await service.getUserGrant(user.id);
  if (!grant || grant.permissions.length === 0) {
    return NextResponse.json({
      allowed: false,
      reason: "KI ist für diesen Benutzer nicht freigeschaltet.",
    });
  }

  return NextResponse.json({
    allowed: true,
    role: user.role,
    grant: {
      permissions: grant.permissions,
      cloudFallbackAllowed: grant.cloudFallbackAllowed,
    },
  });
}
