import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { AdminUserOption, GatewayDashboard, SimulationCase, UsageLogEntry } from "./types";

export function AiGatewayLogsTab({
  data,
  adminUsers,
  usageFilters,
  setUsageFilters,
  filteredUsage,
  usageLoading,
  loadFilteredUsage,
  simulationForm,
  setSimulationForm,
  simulationCases,
  simulationLoading,
  runRoutingSimulation,
  runFallbackTest,
}: {
  data: GatewayDashboard;
  adminUsers: AdminUserOption[];
  usageFilters: { userId: string; feature: string; route: string; success: "" | "true" | "false" };
  setUsageFilters: Dispatch<
    SetStateAction<{ userId: string; feature: string; route: string; success: "" | "true" | "false" }>
  >;
  filteredUsage: UsageLogEntry[] | null;
  usageLoading: boolean;
  loadFilteredUsage: () => Promise<void>;
  simulationForm: { simulateRtxOffline: boolean; privacyFeature: string; userId: string };
  setSimulationForm: Dispatch<
    SetStateAction<{ simulateRtxOffline: boolean; privacyFeature: string; userId: string }>
  >;
  simulationCases: SimulationCase[] | null;
  simulationLoading: boolean;
  runRoutingSimulation: () => Promise<void>;
  runFallbackTest: () => Promise<void>;
}) {
  useEffect(() => {
    void loadFilteredUsage();
  }, [loadFilteredUsage]);

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h3>Verlauf &amp; Tests</h3>
      <div className="uwe-form-grid">
        <label className="uwe-field">
          User
          <select
            className="uwe-input"
            value={usageFilters.userId}
            onChange={(e) => setUsageFilters((f) => ({ ...f, userId: e.target.value }))}
          >
            <option value="">Alle</option>
            {adminUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="uwe-field">
          Feature
          <input
            className="uwe-input"
            value={usageFilters.feature}
            onChange={(e) => setUsageFilters((f) => ({ ...f, feature: e.target.value }))}
            placeholder="z. B. general_chat"
          />
        </label>
        <label className="uwe-field">
          Route
          <input
            className="uwe-input"
            value={usageFilters.route}
            onChange={(e) => setUsageFilters((f) => ({ ...f, route: e.target.value }))}
            placeholder="z. B. local_rtx"
          />
        </label>
        <label className="uwe-field">
          Erfolg
          <select
            className="uwe-input"
            value={usageFilters.success}
            onChange={(e) =>
              setUsageFilters((f) => ({
                ...f,
                success: e.target.value as "" | "true" | "false",
              }))
            }
          >
            <option value="">Alle</option>
            <option value="true">Erfolgreich</option>
            <option value="false">Fehlgeschlagen</option>
          </select>
        </label>
      </div>
      <div className="uwe-form-grid">
        <label className="uwe-checkbox-row">
          <input
            type="checkbox"
            checked={simulationForm.simulateRtxOffline}
            onChange={(e) =>
              setSimulationForm((f) => ({ ...f, simulateRtxOffline: e.target.checked }))
            }
          />
          RTX offline simulieren
        </label>
        <label className="uwe-field">
          Privacy-Feature
          <select
            className="uwe-input"
            value={simulationForm.privacyFeature}
            onChange={(e) =>
              setSimulationForm((f) => ({ ...f, privacyFeature: e.target.value }))
            }
          >
            {Object.keys(data.config.privacyRules).map((feature) => (
              <option key={feature} value={feature}>
                {feature}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="uwe-inline-nav">
        <button
          type="button"
          className="uwe-button-secondary"
          onClick={() => void runRoutingSimulation()}
          disabled={simulationLoading}
        >
          Routing simulieren
        </button>
        <button type="button" className="uwe-button-secondary" onClick={() => void runFallbackTest()}>
          Fallback-Test
        </button>
        <button
          type="button"
          className="uwe-button-secondary"
          onClick={() => void loadFilteredUsage()}
          disabled={usageLoading}
        >
          Filter anwenden
        </button>
      </div>
      {simulationCases && (
        <ul>
          {simulationCases.map((c) => (
            <li key={c.id}>
              {c.passed ? "✓" : "✗"} {c.label} — {c.detail}
            </li>
          ))}
        </ul>
      )}
      <table className="uwe-table uwe-v2-section">
        <thead>
          <tr>
            <th>Zeit</th>
            <th>User</th>
            <th>Feature</th>
            <th>Route</th>
            <th>OK</th>
          </tr>
        </thead>
        <tbody>
          {(filteredUsage ?? data.recentUsage).map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString("de-DE")}</td>
              <td>{log.userDisplayName ?? "—"}</td>
              <td>{log.feature}</td>
              <td>
                {log.route} / {log.provider}
              </td>
              <td>{log.success ? "✓" : "✗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
