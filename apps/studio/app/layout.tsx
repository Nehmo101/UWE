import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getAppRepository, getSystemSettingsSnapshot, resolveThemePreferencesForScope } from "@uwe/database/server";
import {
  ThemeBootstrapScript,
  buildVisualThemeHtmlAttributes,
  toUweThemePreferences,
  type ThemeAppearance,
} from "@uwe/shared-ui";
import { StudioCommandPalette } from "../components/StudioCommandPalette";
import { StudioSessionChrome } from "../components/StudioSessionChrome";
import { GlobalCaptureFab } from "../components/GlobalCaptureFab";
import { ThemeDocumentSync } from "../components/ThemeDocumentSync";
import { StudioThemeSyncProvider } from "../components/StudioThemeSyncProvider";
import { enforceStudioPageAuth } from "@/src/lib/auth";
import "@uwe/shared-ui/uwe.css";
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
  themeColor: "#6366f1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-uwe-pathname") ?? "/";
  await enforceStudioPageAuth(pathname);

  const { settings, updatedAt } = await getSystemSettingsSnapshot();
  const serverThemePreferences = toUweThemePreferences(
    resolveThemePreferencesForScope(settings.app, "studio"),
    "studio",
  );
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

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs}>
      <body>
        <ThemeBootstrapScript
          scope="studio"
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        />
        <StudioThemeSyncProvider
          serverPreferences={serverThemePreferences}
          serverUpdatedAt={updatedAt}
        >
          <ThemeDocumentSync theme={serverTheme} />
          {children}
          <GlobalCaptureFab />
          <StudioCommandPalette worlds={worlds} />
          <StudioSessionChrome />
        </StudioThemeSyncProvider>
      </body>
    </html>
  );
}
