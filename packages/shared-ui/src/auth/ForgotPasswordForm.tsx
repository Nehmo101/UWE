"use client";

import Link from "next/link";
import { useState } from "react";
import type { AuthUiVariant } from "./AuthPageLayout";
import { AuthCard, AuthPageLayout, authClasses } from "./AuthPageLayout";

const SUCCESS_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.";

interface ForgotPasswordFormProps {
  variant: AuthUiVariant;
}

export function ForgotPasswordForm({ variant }: ForgotPasswordFormProps) {
  const classes = authClasses(variant);
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
    <AuthPageLayout variant={variant}>
      <AuthCard
        variant={variant}
        title="Passwort vergessen"
        lead="Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen, falls ein Konto existiert."
        footer={
          <Link href="/login">← Zurück zur Anmeldung</Link>
        }
      >
        {success ? (
          <p className={classes.success} role="status">
            {SUCCESS_MESSAGE}
          </p>
        ) : (
          <form className={classes.form} onSubmit={handleSubmit}>
            <label htmlFor="forgot-email">E-Mail</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {error && (
              <p className={classes.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
              {loading ? "Sende Link…" : "Reset-Link anfordern"}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPageLayout>
  );
}
