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
  title: "UWE Brain",
  description: "Universeller Welten-Editor — privater Brain-Bereich (owner-only)",
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
  // Brain hat seit dem Ghibli-Redesign einen eigenen Theme-Scope ("brain"),
  // damit der Hell/Dunkel-Umschalter dieselbe Persistenz nutzt wie Studio und
  // Portal. Der Scope lebt im settings-JSON (AppThemePreferences) — ohne
  // Schema-Migration.
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
      <body>
        <ThemeBootstrapScript
          scope="brain"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        />
        {children}
      </body>
    </html>
  );
}
