import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Mono, Newsreader } from "next/font/google";
import { getAppRepository, resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { resolveCrossAppUrls } from "@uwe/auth";
import {
  AppUrlsProvider,
  ThemeBootstrapScript,
  ThemeDocumentSync,
  TopBarSessionMount,
  buildVisualThemeHtmlAttributes,
  toCustomThemeDefinitions,
  toUweThemePreferences,
  type ThemeAppearance,
} from "@uwe/shared-ui";

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
import { StudioCommandPalette } from "../components/StudioCommandPalette";
import { StudioSessionChrome } from "../components/StudioSessionChrome";
import { StudioThemeSyncProvider } from "../components/StudioThemeSyncProvider";
import { enforceStudioPageAuth, getCurrentAuthUser } from "@/src/lib/auth";
import { enforceStudioMaintenance } from "@/src/lib/maintenance";
import "@uwe/shared-ui/uwe.css";
import "@uwe/shared-ui/wiki-base.css";
import "@uwe/shared-ui/uwe-landing.css";
import "./globals.css";
import "./wiki.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UWE Studio",
  description: "Universeller Welten-Editor — DM campaign editor",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UWE Studio",
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
    await enforceStudioMaintenance(pathname);
  } catch {
    // Cold-start DB/auth races must not take down the root layout.
  }
  await enforceStudioPageAuth(pathname);

  const { settings, updatedAt } = await getSystemSettingsSnapshotSafe();
  const serverThemePreferences = toUweThemePreferences(
    resolveThemePreferencesForScope(settings.app, "studio"),
    "studio",
  );
  const customThemes = toCustomThemeDefinitions(settings.app.customThemes);
  const visualThemeAttrs = buildVisualThemeHtmlAttributes(settings.app, {
    appVariant: "studio",
  });
  const serverTheme: ThemeAppearance = settings.app.theme;

  let worlds: { name: string; slug: string }[] = [];
  try {
    worlds = (await getAppRepository().listWorlds()).map((world) => ({
      name: world.name,
      slug: world.slug,
    }));
  } catch {
    // Database not ready (e.g. first start before migration) — the palette
    // still works with static commands.
  }

  let canRunAdminCommands = false;
  try {
    const currentUser = await getCurrentAuthUser();
    canRunAdminCommands = currentUser?.isOwner === true;
  } catch {
    // Auth/DB not ready — palette works without the admin-command entry.
  }

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs} className={`${spaceMono.variable} ${newsreader.variable}`}>
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
        <StudioThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
          customThemes={customThemes}
        >
          <ThemeDocumentSync theme={serverTheme} />
          {/* Die Produkt-Origins kommen aus der Laufzeit-Umgebung, nicht aus dem
              Build: eine nachträglich gesetzte oder abgeleitete Family-Adresse
              erreicht ein fertiges Client-Bundle sonst nie. */}
          <AppUrlsProvider value={resolveCrossAppUrls()}>{children}</AppUrlsProvider>
          <StudioCommandPalette worlds={worlds} canRunAdminCommands={canRunAdminCommands} />
          <TopBarSessionMount>
            <StudioSessionChrome />
          </TopBarSessionMount>
        </StudioThemeSyncProvider>
      </body>
    </html>
  );
}
