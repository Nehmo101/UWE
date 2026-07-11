"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";
import Link from "next/link";
import { PasswordStrengthMeter } from "@uwe/shared-ui";
import { Alert, Button, Input, Label } from "@/src/components/ui";

interface ChangePasswordFormProps {
  backHref?: string;
  forcePasswordChange?: boolean;
  /** User has no password yet (e.g. after restore via reset-token login). */
  initialPasswordOnly?: boolean;
}

export function ChangePasswordForm({
  backHref = "/",
  forcePasswordChange = false,
  initialPasswordOnly = false,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);

    const response = await fetch(studioApiUrl("/api/auth/change-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: initialPasswordOnly ? undefined : currentPassword,
        newPassword,
        initialPasswordOnly,
      }),
    });

    setLoading(false);

    const payload = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(payload.error ?? "Passwortänderung fehlgeschlagen.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(payload.message ?? "Passwort wurde geändert.");
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {(forcePasswordChange || initialPasswordOnly) && (
        <p className="text-sm text-muted-foreground">
          {initialPasswordOnly
            ? "Lege dein erstes Passwort fest, um dein Konto zu aktivieren."
            : "Du musst dein Passwort ändern, bevor du fortfahren kannst."}
        </p>
      )}

      {!initialPasswordOnly && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">Aktuelles Passwort</Label>
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={8}
          required
        />
        <PasswordStrengthMeter password={newPassword} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Neues Passwort bestätigen</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>

      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {success && <Alert tone="success" role="status">{success}</Alert>}

      <Button type="submit" disabled={loading} className="self-start">
        {loading ? "Speichern…" : initialPasswordOnly ? "Passwort festlegen" : "Passwort ändern"}
      </Button>

      <p className="text-sm">
        <Link href={backHref} className="text-primary underline-offset-4 hover:underline">
          Zurück
        </Link>
        {initialPasswordOnly && (
          <>
            {" · "}
            <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              Passwort-Reset anfordern
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
