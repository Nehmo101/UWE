import type { PrismaClient } from "@uwe/database/server";
import { createConnectorService } from "@uwe/database/server";

import { isConnectorLlmAvailable } from "../providers/connectorQueueProvider";
import { checkEngineHealth, type EngineHealthStatus } from "./engineHealthcheck";

export type EngineReadinessSource = EngineHealthStatus["source"] | "connector";

export interface EngineReadinessStatus extends Omit<EngineHealthStatus, "source"> {
  source: EngineReadinessSource;
  /** True when readiness comes from an outbound Maschinenraum heartbeat. */
  connectorReady?: boolean;
  connectorOnlineCount?: number;
  connectorDegraded?: boolean;
  connectorLastError?: string | null;
}

export interface EngineReadinessOptions {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
  prisma?: PrismaClient;
}

function countConnectorModels(
  connectors: Awaited<ReturnType<ReturnType<typeof createConnectorService>["summarize"]>>["connectors"],
): number {
  return connectors.reduce((count, connector) => {
    if (connector.disabled || (connector.status !== "online" && connector.status !== "degraded")) {
      return count;
    }
    const models = Array.isArray(connector.models) ? connector.models : [];
    return (
      count +
      models.filter(
        (model) =>
          model &&
          typeof model === "object" &&
          (model as { enabledForUwe?: boolean }).enabledForUwe !== false &&
          (model as { modelType?: string }).modelType !== "embedding",
      ).length
    );
  }, 0);
}

/**
 * Unified Maschinenraum readiness — direct inference health **or** an online outbound
 * connector advertising `llm_local`. This is the single source of truth for
 * routing, admin status, AI gateway, and KI chat chips.
 */
export async function checkEngineReadiness(
  options?: EngineReadinessOptions,
): Promise<EngineReadinessStatus> {
  const direct = await checkEngineHealth({
    useMock: options?.useMock,
    env: options?.env,
  });

  if (!options?.prisma || options.useMock) {
    return direct;
  }

  const [connectorAvailable, summary] = await Promise.all([
    isConnectorLlmAvailable(options.prisma),
    createConnectorService(options.prisma).summarize(),
  ]);

  const liveConnectors = summary.connectors.filter(
    (connector) =>
      !connector.disabled &&
      (connector.status === "online" || connector.status === "degraded"),
  );
  const degradedConnector = liveConnectors.find(
    (connector) => connector.status === "degraded" && connector.lastError,
  );
  const modelCount = countConnectorModels(summary.connectors);

  if (connectorAvailable) {
    const connectorMessage = degradedConnector?.lastError
      ? `Maschinenraum bereit (${modelCount} Modell(e)), meldet aber einen Fehler.`
      : `Maschinenraum bereit (${modelCount} Modell(e)).`;

    return {
      ...direct,
      online: true,
      ready: true,
      source: "connector",
      message: connectorMessage,
      modelCount: modelCount > 0 ? modelCount : direct.modelCount,
      connectorReady: true,
      connectorOnlineCount: liveConnectors.length,
      connectorDegraded: Boolean(degradedConnector),
      connectorLastError: degradedConnector?.lastError ?? null,
      agentStatus: degradedConnector ? "error" : direct.agentStatus,
    };
  }

  return {
    ...direct,
    connectorReady: false,
    connectorOnlineCount: liveConnectors.length,
    connectorDegraded: Boolean(degradedConnector),
    connectorLastError: degradedConnector?.lastError ?? null,
  };
}

export async function isEngineReadinessReady(options?: EngineReadinessOptions): Promise<boolean> {
  const status = await checkEngineReadiness(options);
  return status.ready;
}
