import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Mono, Newsreader } from "next/font/google";
import { getSystemSettingsSnapshotSafe, isPortalGloballyEnabled, resolveThemePreferencesForScope } from "@uwe/database/server";
import {
  ThemeBootstrapScript,
  ThemeDocumentSync,
  buildVisualThemeHtmlAttributes,
  toUweThemePreferences,
  type ThemeAppearance,
} from "@uwe/shared-ui";
import "@uwe/shared-ui/uwe.css";
import "@uwe/shared-ui/wiki-base.css";
import "./globals.css";
import "./wiki.css";
import { PortalThemeSyncProvider } from "../components/PortalThemeSyncProvider";
import { PortalSessionChrome } from "../components/PortalSessionChrome";
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
  const serverTheme: ThemeAppearance = settings.app.theme;

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs} className={`${spaceMono.variable} ${newsreader.variable}`}>
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
          <ThemeDocumentSync theme={serverTheme} />
          {portalEnabled ? (
            <>
              {children}
              <PortalSessionChrome />
            </>
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
