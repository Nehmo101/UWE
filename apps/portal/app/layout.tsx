import type { Metadata } from "next";
import "@uwe/shared-ui/uwe.css";
import "./globals.css";
import "./wiki.css";

export const metadata: Metadata = {
  title: "UWE Portal",
  description: "Universeller Welten-Editor — player portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
