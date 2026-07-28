import type { Metadata, Viewport } from "next";
import { Space_Mono, Newsreader } from "next/font/google";
import { resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import {
  ThemeBootstrapScript,
  buildVisualThemeHtmlAttributes,
  toCustomThemeDefinitions,
  toUweThemePreferences,
  type CustomThemeDefinition,
  type UweThemePreferences,
  type VisualThemeHtmlAttributes,
} from "@uwe/shared-ui";
import { LandingThemeSyncProvider } from "@/src/components/LandingThemeSyncProvider";
import "@uwe/shared-ui/uwe.css";
import "@uwe/shared-ui/uwe-landing.css";
import "./globals.css";

export const dynamic = "force-dynamic";

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

export const metadata: Metadata = {
  title: "UWE — Universeller Welten-Editor",
  description: "Self-hosted Kampagnen- und Admin-Cockpit — läuft lokal auf deiner Hardware.",
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
  // Die Landing führt in Studio, Portal und Brain — der Hell/Dunkel-Umschalter
  // in ihrer Nav nutzt deshalb den Studio-Scope, damit die Wahl beim Sprung auf
  // studio.uwe.example erhalten bleibt.
  let serverThemePreferences: UweThemePreferences | null = null;
  let updatedAt: string | null = null;
  let visualThemeAttrs: VisualThemeHtmlAttributes | undefined;
  let customThemes: CustomThemeDefinition[] = [];
  try {
    const snapshot = await getSystemSettingsSnapshotSafe();
    updatedAt = snapshot.updatedAt;
    serverThemePreferences = toUweThemePreferences(
      resolveThemePreferencesForScope(snapshot.settings.app, "studio"),
      "studio",
    );
    customThemes = toCustomThemeDefinitions(snapshot.settings.app.customThemes);
    visualThemeAttrs = buildVisualThemeHtmlAttributes(snapshot.settings.app, {
      appVariant: "studio",
    });
  } catch {
    // Ein kalter Start ohne DB darf die öffentliche Startseite nicht kippen —
    // das Bootstrap-Script fällt dann auf den Scope-Default zurück.
  }

  return (
    <html
      lang="de"
      suppressHydrationWarning
      {...visualThemeAttrs}
      data-uwe-app="landing"
      className={`${spaceMono.variable} ${newsreader.variable}`}
    >
      {/* Das ThemeBootstrapScript setzt Klasse und data-Attribute auf <body>,
          bevor React hydratisiert — das ist Absicht (Anti-FOUC) und deshalb
          kein zu meldender Mismatch. */}
      <body suppressHydrationWarning>
        <ThemeBootstrapScript
          scope="studio"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
          customThemes={customThemes}
        />
        {/* Der Theme-Kontext muss die Seite umschließen: die Nav trägt den
            Hell/Dunkel-Umschalter, und der liest `useUweTheme()`. */}
        <LandingThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
          customThemes={customThemes}
        >
          {children}
        </LandingThemeSyncProvider>
      </body>
    </html>
  );
}
