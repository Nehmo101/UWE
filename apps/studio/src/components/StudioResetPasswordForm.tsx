"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, LoadingState } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { StudioAuthShell } from "./StudioAuthShell";

function StudioResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const emailFromUrl = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "Der Reset-Link ist ungültig oder unvollständig.",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Der Reset-Link ist ungültig oder abgelaufen.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    if (!email.trim()) {
      setError("Bitte gib die E-Mail-Adresse deines Kontos ein.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        resetToken: token,
        newPassword,
      }),
    });

    setLoading(false);

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Der Reset-Link ist ungültig oder abgelaufen.");
      return;
    }

    router.push("/login?reset=success");
    router.refresh();
  }

  return (
    <StudioAuthShell
      title="Neues Passwort setzen"
      description="Wähle ein sicheres Passwort mit mindestens 8 Zeichen."
      footer={<Link href="/login">← Zurück zur Anmeldung</Link>}
    >
      {!token ? (
        <div className="space-y-3">
          <Alert tone="danger">{error}</Alert>
          <p className="text-sm text-muted-foreground">
            Fordere einen neuen Link an:{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Passwort vergessen
            </Link>
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!emailFromUrl ? (
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-Mail</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reset-password">Neues Passwort</Label>
            <Input
              id="reset-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">Passwort bestätigen</Label>
            <Input
              id="reset-password-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" disabled={loading}>
            {loading ? "Speichere…" : "Passwort speichern"}
          </Button>
        </form>
      )}
    </StudioAuthShell>
  );
}

export function StudioResetPasswordForm() {
  return (
    <Suspense fallback={<LoadingState title="Lade Formular…" />}>
      <StudioResetPasswordFormInner />
    </Suspense>
  );
}
