import {
  BACKGROUND_PATTERN_LABELS,
  ThemeSettingsPanel,
  ThemePicker,
  VisualThemePreview,
} from "@uwe/shared-ui";
import { SettingsCollapsiblePanel } from "../../components/SettingsCollapsiblePanel";
import { SettingsGeneralTab } from "./SettingsGeneralTab";
import {
  BACKGROUND_PATTERN_VALUES,
  getAppRepository,
  resolveThemePreferencesForScope,
} from "@uwe/database/server";
import { updateSettingsAction } from "../settings-actions";
import { PortalThemeSettingsSection } from "../../components/PortalThemeSettingsSection";
import { DesignAssistantWizard } from "../../components/DesignAssistantWizard";
import { CustomThemesManager } from "../../components/CustomThemesManager";
import { SettingsShell, ShellBreadcrumb } from "@/src/components/shell";
import { Alert, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui";

/**
 * Studio-Einstellungen — Design und die eigene Startseite.
 *
 * Systemkonfiguration steht nicht mehr hier: Portal, Welten, KI, Mail, Image
 * Studio, Speicher, Backup, Briefing, Privatsphäre, Anmeldung und Notfallmodus
 * laufen über die Kommandozentrale auf dem Host (Notiz Lasse, Abschnitt D33).
 * Was bleibt, ist das, wofür man die App vor sich haben muss: wie sie aussieht.
 */

interface Props {
  searchParams: Promise<{ saved?: string }>;
}

const HINT_CLASS = "text-sm text-muted-foreground";
const FORM_CLASS = "flex flex-col gap-4";
const STACK_CLASS = "flex flex-col gap-6";
const FIELD_CLASS = "flex flex-col gap-1.5";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

/** Kompakter Label+Select-Wrapper für Felder ohne Leerwert-Bedarf (Kit-Select). */
function FieldSelect({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: Props) {
  const { saved } = await searchParams;
  const settings = await getAppRepository().getSystemSettings();

  return (
    <>
      <ShellBreadcrumb items={[{ label: "Einstellungen" }]} />
      <SettingsShell
        title="Design & Startseite"
        description="Wie Studio und das Portal aussehen, und wohin dich / nach der Anmeldung bringt."
      >
        {saved === "1" && (
          <Alert tone="success" className="mb-4">
            Einstellungen gespeichert.
          </Alert>
        )}

        <Alert tone="info" className="mb-4">
          Systemkonfiguration &mdash; Portal, KI, Mail, Speicher, Backup, Briefing, Notfallmodus
          &mdash; liegt in der Kommandozentrale auf dem UWE-Host.
        </Alert>

        <div className={STACK_CLASS}>
          <SettingsGeneralTab defaultLandingPage={settings.app.defaultLandingPage} />

          <ThemeSettingsPanel />

          <SettingsCollapsiblePanel
            title="Neues Design mit KI erstellen"
            summary="Farbpalette per Fragebogen-Chat mit dem lokalen RTX-Assistenten"
            defaultOpen={false}
          >
            <DesignAssistantWizard />
          </SettingsCollapsiblePanel>

          {(settings.app.customThemes?.length ?? 0) > 0 && (
            <SettingsCollapsiblePanel
              title="Eigene Designs verwalten"
              summary={`${settings.app.customThemes?.length} gespeicherte(s) Custom-Design(s)`}
              defaultOpen={false}
            >
              <CustomThemesManager themes={settings.app.customThemes ?? []} />
            </SettingsCollapsiblePanel>
          )}

          <SettingsCollapsiblePanel
            title="Portal-Design"
            summary="Separates Theme für das Spieler-Portal"
            defaultOpen
          >
            <PortalThemeSettingsSection
              initialPreferences={resolveThemePreferencesForScope(settings.app, "portal")}
            />
          </SettingsCollapsiblePanel>

          <SettingsCollapsiblePanel
            title="Server-Standards (SSR)"
            summary="Dark/Light, Muster, Motion beim ersten Paint"
            defaultOpen={false}
          >
            <form id="settings-visual-preview-form" action={updateSettingsAction} className={FORM_CLASS}>
              <input type="hidden" name="tab" value="general" />
              <p className={HINT_CLASS}>
                Dark/Light/System und Motion für <code>data-uwe-*</code>-Attribute beim ersten
                Paint. Preset-Themes und erweiterte Optionen werden über das Studio-Panel oben
                synchronisiert.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={FORM_CLASS}>
                  <ThemePicker defaultValue={settings.app.theme} preview />
                  <FieldSelect
                    id="settings-background-pattern"
                    name="backgroundPattern"
                    label="Hintergrundmuster"
                    defaultValue={settings.app.backgroundPattern}
                    options={BACKGROUND_PATTERN_VALUES.map((pattern) => ({
                      value: pattern,
                      label: BACKGROUND_PATTERN_LABELS[pattern],
                    }))}
                  />
                  <p className={HINT_CLASS}>
                    Reine CSS-Muster ohne Canvas — abschaltbar über &bdquo;Keins&ldquo;. Auf
                    Mobilgeräten keine Daueranimationen.
                  </p>
                  {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                  <label className={CHECKBOX_ROW_CLASS}>
                    <input
                      type="checkbox"
                      name="frostedGlass"
                      value="on"
                      defaultChecked={settings.app.frostedGlass}
                      className={CHECKBOX_CLASS}
                    />
                    Frosted Glass (Milchglas-Oberflächen)
                  </label>
                  <p className={HINT_CLASS}>
                    Aus = undurchsichtige Panels für maximale Lesbarkeit. An = dezenter
                    Backdrop-Blur auf Karten, Leisten und Modals.
                  </p>
                  <label className={CHECKBOX_ROW_CLASS}>
                    <input
                      type="checkbox"
                      name="motionEnabled"
                      value="on"
                      defaultChecked={settings.app.motionEnabled}
                      className={CHECKBOX_CLASS}
                    />
                    Dezente UI-Animationen
                  </label>
                  <p className={HINT_CLASS}>
                    Respektiert immer <code>prefers-reduced-motion</code> des Systems.
                  </p>
                </div>
                <VisualThemePreview
                  formId="settings-visual-preview-form"
                  initial={{
                    theme: settings.app.theme,
                    backgroundPattern: settings.app.backgroundPattern,
                    frostedGlass: settings.app.frostedGlass,
                    motionEnabled: settings.app.motionEnabled,
                  }}
                />
              </div>
              <Button type="submit">Server-Standards speichern</Button>
            </form>
          </SettingsCollapsiblePanel>
        </div>
      </SettingsShell>
    </>
  );
}
