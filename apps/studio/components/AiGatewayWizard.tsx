"use client";

import { Tabs } from "@uwe/shared-ui";
import { useEffect } from "react";
import { Alert } from "@/src/components/ui";
import { AiGatewayLogsTab } from "./ai-gateway/AiGatewayLogsTab";
import { AiGatewayModelsTab } from "./ai-gateway/AiGatewayModelsTab";
import { AiGatewayOverviewCard } from "./ai-gateway/AiGatewayOverviewCard";
import { AI_GATEWAY_TABS } from "./ai-gateway/constants";
import { useAiGateway } from "./ai-gateway/use-ai-gateway";
import type { GatewayDashboard } from "./ai-gateway/types";

/**
 * KI-Gateway.
 *
 * This screen used to manage cloud providers, per-user grants, spend budgets,
 * privacy rules and a routing simulator. All of that went away with the cloud
 * providers themselves — the Maschinenraum host is the only backend, so there is no route
 * to police, no key to store and no spend to cap. What is left is choosing the
 * local model per feature and reading the usage log.
 */
export function AiGatewayWizard({ initialData }: { initialData?: GatewayDashboard | null }) {
  const gateway = useAiGateway(initialData);
  const { data, loading, error, message, loadAdminUsers } = gateway;

  useEffect(() => {
    void loadAdminUsers();
  }, [loadAdminUsers]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">KI-Gateway wird geladen…</p>;
  }

  if (error) {
    return (
      <Alert tone="danger" role="alert">
        {error}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const tabItems = AI_GATEWAY_TABS.map((tab) => {
    switch (tab.id) {
      case "models":
        return {
          id: tab.id,
          label: tab.label,
          content: (
            <AiGatewayModelsTab data={data} patchFeatureModel={gateway.patchFeatureModel} />
          ),
        };
      case "logs":
      default:
        return {
          id: tab.id,
          label: tab.label,
          content: (
            <AiGatewayLogsTab
              data={data}
              adminUsers={gateway.adminUsers}
              usageFilters={gateway.usageFilters}
              setUsageFilters={gateway.setUsageFilters}
              filteredUsage={gateway.filteredUsage}
              usageLoading={gateway.usageLoading}
              loadFilteredUsage={gateway.loadFilteredUsage}
              runFallbackTest={gateway.runFallbackTest}
            />
          ),
        };
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <AiGatewayOverviewCard data={data} />
      {message && (
        <Alert tone="success" role="status">
          {message}
        </Alert>
      )}
      <Tabs items={tabItems} defaultTabId="models" ariaLabel="KI-Gateway" />
    </div>
  );
}
