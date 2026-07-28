import type { Metadata, Viewport } from "next";
import { Space_Mono, Newsreader } from "next/font/google";
import { resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import {
  ThemeBootstrapScript,
  buildVisualThemeHtmlAttributes,
  toUweThemePreferences,
  type UweThemePreferences,
  type VisualThemeHtmlAttributes,
} from "@uwe/shared-ui";
import { FamilyThemeSyncProvider } from "@/src/components/FamilyThemeSyncProvider";
import "@uwe/shared-ui/uwe.css";
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
  title: "UWE Family",
  description: "Universeller Welten-Editor — gemeinsamer Family-Bereich",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#100e16",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Family teilt sich den Theme-Scope "brain": beide sind lokale Owner-nahe
  // Apps mit derselben Optik, und ein eigener Scope hiesse eine Aenderung an
  // AppThemePreferences und am Theme-Bootstrap. Sobald Family eine eigene
  // Farbwelt bekommen soll, ist das der Ort dafuer.
  let serverThemePreferences: UweThemePreferences | null = null;
  let updatedAt: string | null = null;
  let visualThemeAttrs: VisualThemeHtmlAttributes | undefined;
  try {
    const snapshot = await getSystemSettingsSnapshotSafe();
    updatedAt = snapshot.updatedAt;
    serverThemePreferences = toUweThemePreferences(
      resolveThemePreferencesForScope(snapshot.settings.app, "brain"),
      "brain",
    );
    visualThemeAttrs = buildVisualThemeHtmlAttributes(snapshot.settings.app, {
      appVariant: "brain",
    });
  } catch {
    // Ein kalter Start ohne DB darf das Root-Layout nicht kippen — das
    // Bootstrap-Script fällt dann auf den Scope-Default zurück.
  }

  return (
    <html
      lang="de"
      suppressHydrationWarning
      {...visualThemeAttrs}
      data-uwe-app="brain"
      className={`${spaceMono.variable} ${newsreader.variable}`}
    >
      {/* Das ThemeBootstrapScript setzt Klasse und data-Attribute auf <body>,
          bevor React hydratisiert — das ist Absicht (Anti-FOUC) und deshalb
          kein zu meldender Mismatch. */}
      <body suppressHydrationWarning>
        <ThemeBootstrapScript
          scope="brain"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        />
        {/* Der Theme-Kontext muss die ganze App umschließen: die Topbar der
            FamilyShell trägt den Hell/Dunkel-Umschalter, und der liest
            `useUweTheme()`. Fehlt der Provider, kippt jede Family-Seite. */}
        <FamilyThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        >
          {children}
        </FamilyThemeSyncProvider>
      </body>
    </html>
  );
}
