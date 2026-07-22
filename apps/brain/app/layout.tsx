import type { Metadata, Viewport } from "next";
import "@uwe/shared-ui/uwe.css";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UWE Brain",
  description: "Universeller Welten-Editor — privater Brain-Bereich (owner-only, lokal)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5c5470",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
