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
  className = "uwe-btn uwe-btn-ghost",
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
