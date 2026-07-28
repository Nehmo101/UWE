export type RoutingMode = "LOCAL_ONLY" | "DISABLED";
export type PrivacyLevel = "CLOUD_ALLOWED" | "CLOUD_FORBIDDEN" | "LOCAL_REQUIRED";

export interface AdminUserOption {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
}

export interface UsageLogEntry {
  id: string;
  userDisplayName: string | null;
  feature: string;
  taskType: string | null;
  provider: string;
  model: string;
  route: string;
  success: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

export interface GatewayDashboard {
  config: {
    routingMode: RoutingMode;
    cloudFallbackEnabled: boolean;
    privacyRules: Record<string, PrivacyLevel>;
    featureModels: Record<string, { providerId?: string | null; model?: string | null }>;
    dailyBudgetUsd: number | null;
    monthlyBudgetUsd: number | null;
    perUserDailyBudgetUsd: number | null;
    updatedAt: string;
  };
  providers: Array<{
    id: string;
    providerId: string;
    label: string;
    hasApiKey: boolean;
    isEnabled: boolean;
    defaultModel: string | null;
    priority: number;
  }>;
  budget: {
    dailySpentUsd: number;
    monthlySpentUsd: number;
    userDailySpentUsd: number;
    dailyLimitUsd: number | null;
    monthlyLimitUsd: number | null;
    userDailyLimitUsd: number | null;
    withinBudget: boolean;
  };
  rtxHealth: {
    ready: boolean;
    message?: string;
    source?: "agent" | "inference" | "connector";
    connectorReady?: boolean;
    connectorOnlineCount?: number;
    connectorDegraded?: boolean;
  };
  userGrants: Array<{
    id: string;
    userId: string;
    displayName: string;
    email: string | null;
    permissions: string[];
    cloudFallbackAllowed: boolean;
  }>;
  recentUsage: UsageLogEntry[];
}

export interface SimulationCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}
