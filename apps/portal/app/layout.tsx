import type { Metadata, Viewport } from "next";
import { ThemeBootstrapScript, ThemeProvider } from "@uwe/shared-ui";
import "@uwe/shared-ui/uwe.css";
import "./globals.css";
import "./wiki.css";
import { buildVisualThemeHtmlAttributes } from "@uwe/shared-ui";
import { getSystemSettings, isPortalGloballyEnabled } from "@uwe/database/server";

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
  const settings = await getSystemSettings();
  const portalEnabled = isPortalGloballyEnabled(settings);
  const visualThemeAttrs = buildVisualThemeHtmlAttributes(settings.app, {
    appVariant: "portal",
  });

  return (
    <html lang="de" suppressHydrationWarning {...visualThemeAttrs}>
      <body>
        <ThemeBootstrapScript scope="portal" />
        <ThemeProvider scope="portal">
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
        </ThemeProvider>
      </body>
    </html>
  );
}
