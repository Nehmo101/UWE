import { ResponsiveTable, StatusPill } from "@uwe/shared-ui";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";
import type { AdminUserOption, GatewayDashboard, UsageLogEntry } from "./types";

/** TODO(design-kit): Controlled Selects (User, Erfolg, Privacy-Feature) bleiben nativ — Kit-Select
    (Radix) ist hier direkt an lokalen State/Props gebunden, siehe gleiches Muster in JobsWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";


export function AiGatewayLogsTab({
  data,
  adminUsers,
  usageFilters,
  setUsageFilters,
  filteredUsage,
  usageLoading,
  loadFilteredUsage,
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
  runFallbackTest: () => Promise<void>;
}) {
  useEffect(() => {
    void loadFilteredUsage();
  }, [loadFilteredUsage]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verlauf &amp; Tests</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-logs-user">User</Label>
            <select
              id="ai-gateway-logs-user"
              className={NATIVE_SELECT_CLASS}
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-logs-feature">Feature</Label>
            <Input
              id="ai-gateway-logs-feature"
              value={usageFilters.feature}
              onChange={(e) => setUsageFilters((f) => ({ ...f, feature: e.target.value }))}
              placeholder="z. B. general_chat"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-logs-route">Route</Label>
            <Input
              id="ai-gateway-logs-route"
              value={usageFilters.route}
              onChange={(e) => setUsageFilters((f) => ({ ...f, route: e.target.value }))}
              placeholder="z. B. local_rtx"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-logs-success">Erfolg</Label>
            <select
              id="ai-gateway-logs-success"
              className={NATIVE_SELECT_CLASS}
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void runFallbackTest()}>
            RTX-Erreichbarkeit prüfen
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadFilteredUsage()}
            disabled={usageLoading}
          >
            Filter anwenden
          </Button>
        </div>
        <ResponsiveTable
          caption="Letzte KI-Aufrufe"
          rowKey={(log) => log.id}
          rows={filteredUsage ?? data.recentUsage}
          columns={[
            { key: "feature", label: "Feature", primary: true, render: (log) => log.feature },
            {
              key: "ok",
              label: "OK",
              // Zeichen statt Farbe: „✓/✗" bleibt lesbar, wenn Farben es nicht sind.
              render: (log) => (
                <StatusPill glyph={log.success ? "✓" : "✗"} tone={log.success ? "success" : "danger"}>
                  {log.success ? "erfolgreich" : "fehlgeschlagen"}
                </StatusPill>
              ),
            },
            {
              key: "time",
              label: "Zeit",
              render: (log) => new Date(log.createdAt).toLocaleString("de-DE"),
            },
            {
              key: "user",
              label: "User",
              render: (log) => log.userDisplayName ?? "—",
            },
            {
              key: "route",
              label: "Route",
              priority: "low",
              render: (log) => `${log.route} / ${log.provider}`,
            },
          ]}
          empty={<p className="text-sm text-muted-foreground">Keine Aufrufe protokolliert.</p>}
        />
      </CardContent>
    </Card>
  );
}
