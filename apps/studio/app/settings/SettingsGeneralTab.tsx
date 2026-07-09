import Link from "next/link";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import { SettingsCollapsiblePanel } from "@/components/SettingsCollapsiblePanel";
import { TodayDashboardSettings } from "@/components/today/TodayDashboardSettings";

interface SettingsGeneralTabProps {
  todayWidgets: DashboardWidgetConfig[];
}

export function SettingsGeneralTab({ todayWidgets }: SettingsGeneralTabProps) {
  return (
    <div className="uwe-settings-stack">
      <section className="uwe-form">
        <h2>App Settings</h2>
        <p className="uwe-hint">
          Visuelle Themes unter <Link href="/settings?tab=appearance">Design &amp; Theme</Link>.
        </p>
      </section>
      <SettingsCollapsiblePanel
        title="Heute-Dashboard Widgets"
        summary="Sichtbarkeit der Widgets auf /today"
        defaultOpen
      >
        <TodayDashboardSettings initialWidgets={todayWidgets} />
      </SettingsCollapsiblePanel>
      <SettingsCollapsiblePanel
        title="Abgrenzung zu Admin"
        summary="Settings vs. /admin — was gehört wohin"
        defaultOpen={false}
      >
        <p className="uwe-hint">
          <strong>Settings:</strong> persönliche Präferenzen, Portal-Theme, Speicher, Briefing.{" "}
          <strong>Admin:</strong> Nutzer, Security, KI-Gateway, Webhooks. Routing-Policy:{" "}
          <Link href="/admin/ai-gateway">KI-Gateway</Link>.
        </p>
      </SettingsCollapsiblePanel>
    </div>
  );
}
