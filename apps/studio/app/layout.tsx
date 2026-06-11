import type { Metadata } from "next";
import "./globals.css";
import "./wiki.css";

export const metadata: Metadata = {
  title: "UWE Studio",
  description: "Universeller Welten-Editor — DM campaign editor",
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
