"use client";

import { Tabs } from "@uwe/shared-ui";
import { useEffect } from "react";
import { AiGatewayBudgetsTab } from "./ai-gateway/AiGatewayBudgetsTab";
import { AiGatewayGrantsTab } from "./ai-gateway/AiGatewayGrantsTab";
import { AiGatewayLogsTab } from "./ai-gateway/AiGatewayLogsTab";
import { AiGatewayModelsTab } from "./ai-gateway/AiGatewayModelsTab";
import { AiGatewayOverviewCard } from "./ai-gateway/AiGatewayOverviewCard";
import { AiGatewayPrivacyTab } from "./ai-gateway/AiGatewayPrivacyTab";
import { AiGatewayRoutingTab } from "./ai-gateway/AiGatewayRoutingTab";
import { AI_GATEWAY_TABS } from "./ai-gateway/constants";
import { useAiGateway } from "./ai-gateway/use-ai-gateway";

export function AiGatewayWizard() {
  const gateway = useAiGateway();
  const { data, loading, error, message, loadAdminUsers } = gateway;

  useEffect(() => {
    void loadAdminUsers();
  }, [loadAdminUsers]);

  if (loading && !data) {
    return <p className="uwe-muted">KI-Gateway wird geladen…</p>;
  }

  if (error) {
    return (
      <section className="uwe-form-error uwe-v2-section" role="alert">
        {error}
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const tabItems = AI_GATEWAY_TABS.map((tab) => {
    switch (tab.id) {
      case "routing":
        return {
          id: tab.id,
          label: tab.label,
          content: (
            <AiGatewayRoutingTab
              data={data}
              providerForm={gateway.providerForm}
              setProviderForm={gateway.setProviderForm}
              patchConfig={gateway.patchConfig}
              saveProvider={gateway.saveProvider}
            />
          ),
        };
      case "privacy":
        return {
          id: tab.id,
          label: tab.label,
          content: <AiGatewayPrivacyTab data={data} patchConfig={gateway.patchConfig} />,
        };
      case "models":
        return {
          id: tab.id,
          label: tab.label,
          content: (
            <AiGatewayModelsTab data={data} patchFeatureModel={gateway.patchFeatureModel} />
          ),
        };
      case "budgets":
        return {
          id: tab.id,
          label: tab.label,
          content: <AiGatewayBudgetsTab data={data} patchConfig={gateway.patchConfig} />,
        };
      case "grants":
        return {
          id: tab.id,
          label: tab.label,
          content: (
            <AiGatewayGrantsTab
              data={data}
              adminUsers={gateway.adminUsers}
              grantForm={gateway.grantForm}
              setGrantForm={gateway.setGrantForm}
              saveGrant={gateway.saveGrant}
              deleteGrant={gateway.deleteGrant}
            />
          ),
        };
      case "logs":
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
              simulationForm={gateway.simulationForm}
              setSimulationForm={gateway.setSimulationForm}
              simulationCases={gateway.simulationCases}
              simulationLoading={gateway.simulationLoading}
              runRoutingSimulation={gateway.runRoutingSimulation}
              runFallbackTest={gateway.runFallbackTest}
            />
          ),
        };
    }
  });

  return (
    <div className="uwe-section-stack">
      <AiGatewayOverviewCard data={data} />
      {message && (
        <p className="uwe-form-success" role="status">
          {message}
        </p>
      )}
      <Tabs items={tabItems} defaultTabId="routing" ariaLabel="KI-Gateway Policy" />
    </div>
  );
}
