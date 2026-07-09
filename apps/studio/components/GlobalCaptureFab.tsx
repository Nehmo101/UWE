"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GlobalCaptureFab() {
  const pathname = usePathname();
  // Die öffentliche Landing Page ("/") ist ein anonymer Einstieg ohne Studio-
  // Chrome — der Capture-„+" (führt zu /capture) gehört dort nicht hin.
  // /mail hat einen eigenen „Verfassen"-FAB — das Capture-„+" wirkt dort wie
  // ein Mail-Compose-Button und wird deshalb ausgeblendet.
  if (pathname === "/" || pathname.startsWith("/capture") || pathname.startsWith("/mail")) {
    return null;
  }

  return (
    <Link
      href="/capture?quick=1"
      className="uwe-capture-fab"
      aria-label="Schnell erfassen"
      title="Capture"
    >
      +
    </Link>
  );
}
