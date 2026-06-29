"use client";

import { useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PortalAuthShell } from "./PortalAuthShell";

interface SharePasswordFormProps {
  token: string;
}

export function SharePasswordForm({ token }: SharePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/share/${token}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Passwort ungültig");
      return;
    }

    window.location.reload();
  }

  return (
    <PortalAuthShell
      title="Passwort erforderlich"
      description="Dieser Freigabelink ist passwortgeschützt."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="share-password">Passwort</Label>
          <Input
            id="share-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Prüfe…" : "Zugang anfordern"}
        </Button>
      </form>
    </PortalAuthShell>
  );
}
