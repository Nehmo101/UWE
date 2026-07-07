"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GlobalCaptureFab() {
  const pathname = usePathname();
  // /mail hat einen eigenen „Verfassen"-FAB — das Capture-„+" wirkt dort wie
  // ein Mail-Compose-Button und wird deshalb ausgeblendet.
  if (pathname.startsWith("/capture") || pathname.startsWith("/mail")) {
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
