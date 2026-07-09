import Link from "next/link";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import { SettingsCollapsiblePanel } from "@/components/SettingsCollapsiblePanel";
import { TodayDashboardSettings } from "@/components/today/TodayDashboardSettings";
import { updateSettingsAction } from "../settings-actions";
import { normalizeStudioLandingPage, STUDIO_LANDING_PAGE_OPTIONS } from "@/src/lib/studio-landing";

interface SettingsGeneralTabProps {
  todayWidgets: DashboardWidgetConfig[];
  defaultLandingPage?: string | null;
}

export function SettingsGeneralTab({ todayWidgets, defaultLandingPage }: SettingsGeneralTabProps) {
  const landingPage = normalizeStudioLandingPage(defaultLandingPage);
  return (
    <div className="uwe-settings-stack">
      <section className="uwe-form">
        <h2>App Settings</h2>
        <p className="uwe-hint">
          Visuelle Themes unter <Link href="/settings?tab=appearance">Design &amp; Theme</Link>.
        </p>
      </section>

      <SettingsCollapsiblePanel
        title="Studio-Startseite"
        summary="Wohin angemeldete Nutzer von / weitergeleitet werden"
        defaultOpen
      >
        <form action={updateSettingsAction} className="uwe-form">
          <input type="hidden" name="tab" value="landing" />
          <p className="uwe-hint">
            Gilt für alle angemeldeten Studio-Nutzer. Unangemeldete Besucher sehen weiterhin die
            öffentliche Landing Page.
          </p>
          <label>
            Standard-Startseite
            <select name="defaultLandingPage" defaultValue={landingPage}>
              {STUDIO_LANDING_PAGE_OPTIONS.map((option) => (
                <option key={option.path} value={option.path}>
                  {option.label} ({option.path})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Startseite speichern
          </button>
        </form>
      </SettingsCollapsiblePanel>

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
