"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PortalAuthShell } from "./PortalAuthShell";

const SUCCESS_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.";

export function PortalForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Anfrage fehlgeschlagen. Bitte versuche es später erneut.");
      return;
    }

    setSuccess(true);
  }

  return (
    <PortalAuthShell
      title="Passwort vergessen"
      description="Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen, falls ein Konto existiert."
      footer={<Link href="/login">← Zurück zur Anmeldung</Link>}
    >
      {success ? (
        <Alert tone="success">{SUCCESS_MESSAGE}</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-Mail</Label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" disabled={loading}>
            {loading ? "Sende Link…" : "Reset-Link anfordern"}
          </Button>
        </form>
      )}
    </PortalAuthShell>
  );
}
