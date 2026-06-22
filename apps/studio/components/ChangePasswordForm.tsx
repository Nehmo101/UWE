"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";
import Link from "next/link";

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
    <form className="studio-auth-form" onSubmit={handleSubmit}>
      {(forcePasswordChange || initialPasswordOnly) && (
        <p className="studio-auth-lead">
          {initialPasswordOnly
            ? "Lege dein erstes Passwort fest, um dein Konto zu aktivieren."
            : "Du musst dein Passwort ändern, bevor du fortfahren kannst."}
        </p>
      )}

      {!initialPasswordOnly && (
        <>
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
        </>
      )}

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

      {error && <p className="studio-auth-error uwe-auth-message uwe-auth-message-error">{error}</p>}
      {success && (
        <p className="studio-auth-success uwe-auth-message uwe-auth-message-success" role="status">
          {success}
        </p>
      )}

      <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
        {loading ? "Speichern…" : initialPasswordOnly ? "Passwort festlegen" : "Passwort ändern"}
      </button>

      <p className="studio-auth-footer">
        <Link href={backHref}>Zurück</Link>
        {initialPasswordOnly && (
          <>
            {" · "}
            <Link href="/forgot-password">Passwort-Reset anfordern</Link>
          </>
        )}
      </p>
    </form>
  );
}
