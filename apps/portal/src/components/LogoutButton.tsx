"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface LogoutButtonProps {
  displayName: string;
}

export function LogoutButton({ displayName }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className="auth-link-button" disabled={loading} onClick={handleLogout}>
      {loading ? "Abmelden…" : `Abmelden (${displayName})`}
    </button>
  );
}
