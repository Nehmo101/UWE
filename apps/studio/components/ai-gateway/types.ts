// Mirrors AiRoutingMode in @uwe/database — kept as a literal so this client
// bundle never imports server code. LOCAL_THEN_CLOUD/CLOUD_ONLY survive in the
// DB column even though the cloud path is gone.
export type RoutingMode = "LOCAL_ONLY" | "LOCAL_THEN_CLOUD" | "CLOUD_ONLY" | "DISABLED";
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
  engineHealth: {
    ready: boolean;
    message?: string;
    source?: "agent" | "inference" | "connector";
    connectorReady?: boolean;
    connectorOnlineCount?: number;
    connectorDegraded?: boolean;
  };
  recentUsage: UsageLogEntry[];
}

export interface SimulationCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}
