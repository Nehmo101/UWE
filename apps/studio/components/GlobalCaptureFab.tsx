"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GlobalCaptureFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/capture")) {
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
