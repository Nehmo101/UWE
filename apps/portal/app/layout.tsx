import type { Metadata } from "next";
import "@uwe/shared-ui/uwe.css";
import "./globals.css";
import "./wiki.css";
import { getSystemSettings, isPortalGloballyEnabled } from "@uwe/database/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UWE Portal",
  description: "Universeller Welten-Editor — player portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSystemSettings();
  const portalEnabled = isPortalGloballyEnabled(settings);

  return (
    <html lang="de">
      <body>
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
      </body>
    </html>
  );
}
