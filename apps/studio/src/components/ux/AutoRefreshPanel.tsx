"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

interface AutoRefreshPanelProps {
  intervalMs?: number;
  label?: string;
  children: ReactNode;
}

/** Re-fetches server data on an interval via router.refresh(). */
export function AutoRefreshPanel({
  intervalMs = 30_000,
  label,
  children,
}: AutoRefreshPanelProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <>
      {label ? (
        <p className="uwe-dashboard-muted" style={{ marginBottom: "0.75rem" }}>
          {label}
        </p>
      ) : null}
      {children}
    </>
  );
}
