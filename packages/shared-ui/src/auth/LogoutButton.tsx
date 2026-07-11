"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface LogoutButtonProps {
  displayName?: string;
  className?: string;
  redirectTo?: string;
}

export function LogoutButton({
  displayName,
  className = "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  redirectTo = "/",
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    router.push(redirectTo);
    router.refresh();
  }

  const label = displayName
    ? loading
      ? "Abmelden…"
      : `Abmelden (${displayName})`
    : loading
      ? "Abmelden…"
      : "Abmelden";

  return (
    <button type="button" className={className} disabled={loading} onClick={handleLogout}>
      {label}
    </button>
  );
}
