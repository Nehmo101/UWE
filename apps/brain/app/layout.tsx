import type { Metadata, Viewport } from "next";
import { Space_Mono, Newsreader } from "next/font/google";
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
  themeColor: "#1f1b14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      data-uwe-theme="uwe-nachtstudie"
      className={`${spaceMono.variable} ${newsreader.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
