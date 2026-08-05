import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Mono, Newsreader } from "next/font/google";
import { isPortalGloballyEnabled, resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { resolveCrossAppUrls } from "@uwe/auth";
import {
  AppUrlsProvider,
  ThemeBootstrapScript,
  ThemeDocumentSync,
  buildVisualThemeHtmlAttributes,
  toCustomThemeDefinitions,
  toUweThemePreferences,
  type ThemeAppearance,
} from "@uwe/shared-ui";
import "@uwe/shared-ui/uwe.css";
import "@uwe/shared-ui/wiki-base.css";
import "./globals.css";
import "./wiki.css";
import { PortalThemeSyncProvider } from "../components/PortalThemeSyncProvider";
import { PortalSessionChrome } from "../components/PortalSessionChrome";
import { portalBasePath } from "@/src/lib/base-path";
import { enforcePortalMaintenance } from "@/src/lib/maintenance";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--uwe-font-space-mono",
  display: "swap",
});

const newsreader = Newsreader({
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--uwe-font-newsreader",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UWE Portal",
  description: "Universeller Welten-Editor — player portal",
  // Läuft das Portal unter einem Unterpfad, muss auch das Manifest dort liegen.
  manifest: `${portalBasePath()}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UWE Portal",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c2622b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-uwe-pathname") ?? "/";
  try {
    await enforcePortalMaintenance(pathname);
  } catch {
    // Cold-start DB/auth races must not take down the root layout.
  }

  const { settings, updatedAt } = await getSystemSettingsSnapshotSafe();
  const portalEnabled = isPortalGloballyEnabled(settings);
  const visualThemeAttrs = buildVisualThemeHtmlAttributes(settings.app, {
    appVariant: "portal",
  });
  const serverThemePreferences = toUweThemePreferences(
    resolveThemePreferencesForScope(settings.app, "portal"),
    "portal",
  );
  const customThemes = toCustomThemeDefinitions(settings.app.customThemes);
  const serverTheme: ThemeAppearance = settings.app.theme;

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs} className={`${spaceMono.variable} ${newsreader.variable}`}>
      {/* Das ThemeBootstrapScript setzt Klasse und data-Attribute auf <body>,
          bevor React hydratisiert — das ist Absicht (Anti-FOUC) und deshalb
          kein zu meldender Mismatch. */}
      <body suppressHydrationWarning>
        <ThemeBootstrapScript
          scope="portal"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
          customThemes={customThemes}
        />
        <PortalThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
          customThemes={customThemes}
        >
          <ThemeDocumentSync theme={serverTheme} />
          {portalEnabled ? (
            // Produkt-Origins zur Laufzeit, nicht aus dem Build — siehe
            // AppUrlsProvider.
            <AppUrlsProvider value={resolveCrossAppUrls()}>
              {children}
              <PortalSessionChrome />
            </AppUrlsProvider>
          ) : (
            <main className="page">
              <div className="card">
                <h2>Portal deaktiviert</h2>
                <p>
                  Das UWE Portal ist derzeit in den Systemeinstellungen deaktiviert.
                </p>
              </div>
            </main>
          )}
        </PortalThemeSyncProvider>
      </body>
    </html>
  );
}
