import Link from "next/link";
import { SettingsCollapsiblePanel } from "@/components/SettingsCollapsiblePanel";
import { updateSettingsAction } from "../settings-actions";
import { normalizeStudioLandingPage, STUDIO_LANDING_PAGE_OPTIONS } from "@/src/lib/studio-landing";
import { Button, Label } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe PageChroniclePanel.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface SettingsGeneralTabProps {
  defaultLandingPage?: string | null;
}

export function SettingsGeneralTab({ defaultLandingPage }: SettingsGeneralTabProps) {
  const landingPage = normalizeStudioLandingPage(defaultLandingPage);
  return (
    <div className="grid gap-3">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">App Settings</h2>
        <p className="text-sm text-muted-foreground">
          Visuelle Themes unter <Link href="/settings?tab=appearance">Design &amp; Theme</Link>.
        </p>
      </section>

      <SettingsCollapsiblePanel
        title="Studio-Startseite"
        summary="Wohin angemeldete Nutzer von / weitergeleitet werden"
        defaultOpen
      >
        <form action={updateSettingsAction} className="flex flex-col gap-4">
          <input type="hidden" name="tab" value="landing" />
          <p className="text-sm text-muted-foreground">
            Gilt für alle angemeldeten Studio-Nutzer. Unangemeldete Besucher sehen weiterhin die
            öffentliche Landing Page.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-general-landing-page">Standard-Startseite</Label>
            <select
              id="settings-general-landing-page"
              name="defaultLandingPage"
              defaultValue={landingPage}
              className={NATIVE_SELECT_CLASS}
            >
              {STUDIO_LANDING_PAGE_OPTIONS.map((option) => (
                <option key={option.path} value={option.path}>
                  {option.label} ({option.path})
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="self-start">
            Startseite speichern
          </Button>
        </form>
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel
        title="Abgrenzung zu Admin"
        summary="Settings vs. /admin — was gehört wohin"
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          <strong>Settings:</strong> persönliche Präferenzen, Portal-Theme, Speicher, Briefing.{" "}
          <strong>Admin:</strong> Nutzer, Security, KI-Gateway, Webhooks. Routing-Policy:{" "}
          <Link href="/admin/ai-gateway">KI-Gateway</Link>.
        </p>
      </SettingsCollapsiblePanel>
    </div>
  );
}
