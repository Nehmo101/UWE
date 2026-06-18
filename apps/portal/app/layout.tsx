import type { Metadata, Viewport } from "next";
import { getSystemSettingsSnapshot, isPortalGloballyEnabled, resolveThemePreferencesForScope } from "@uwe/database/server";
import { ThemeBootstrapScript, buildVisualThemeHtmlAttributes, toUweThemePreferences } from "@uwe/shared-ui";
import "@uwe/shared-ui/uwe.css";
import "./globals.css";
import "./wiki.css";
import { PortalThemeSyncProvider } from "../components/PortalThemeSyncProvider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UWE Portal",
  description: "Universeller Welten-Editor — player portal",
  manifest: "/manifest.webmanifest",
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
  themeColor: "#7c3aed",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings, updatedAt } = await getSystemSettingsSnapshot();
  const portalEnabled = isPortalGloballyEnabled(settings);
  const visualThemeAttrs = buildVisualThemeHtmlAttributes(settings.app, {
    appVariant: "portal",
  });
  const serverThemePreferences = toUweThemePreferences(
    resolveThemePreferencesForScope(settings.app, "portal"),
    "portal",
  );

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs}>
      <body>
        <ThemeBootstrapScript
          scope="portal"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        />
        <PortalThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        >
          {portalEnabled ? (
            children
          ) : (
            <main className="page">
              <div className="card">
                <h2>Portal deaktiviert</h2>
                <p>
                  Das UWE Portal ist derzeit in den Admin-Einstellungen deaktiviert.
                </p>
              </div>
            </main>
          )}
        </PortalThemeSyncProvider>
      </body>
    </html>
  );
}
