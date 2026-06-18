"use client";

import { useState } from "react";
import Link from "next/link";

interface ChangePasswordFormProps {
  backHref?: string;
  forcePasswordChange?: boolean;
}

export function ChangePasswordForm({
  backHref = "/",
  forcePasswordChange = false,
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

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
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
    <form className="studio-auth-form" onSubmit={handleSubmit}>
      {forcePasswordChange && (
        <p className="studio-auth-lead">
          Du musst dein Passwort ändern, bevor du fortfahren kannst.
        </p>
      )}

      <label htmlFor="current-password">Aktuelles Passwort</label>
      <input
        id="current-password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        required
      />

      <label htmlFor="new-password">Neues Passwort</label>
      <input
        id="new-password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        minLength={8}
        required
      />

      <label htmlFor="confirm-password">Neues Passwort bestätigen</label>
      <input
        id="confirm-password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        minLength={8}
        required
      />

      {error && <p className="studio-auth-error">{error}</p>}
      {success && (
        <p className="studio-auth-lead" role="status">
          {success}
        </p>
      )}

      <button type="submit" disabled={loading}>
        {loading ? "Speichern…" : "Passwort ändern"}
      </button>

      <p className="studio-auth-footer">
        <Link href={backHref}>Zurück</Link>
      </p>
    </form>
  );
}
