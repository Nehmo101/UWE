"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";

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
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" type="button" disabled={loading} onClick={handleLogout}>
      {loading ? "Abmelden…" : `Abmelden (${displayName})`}
    </Button>
  );
}
