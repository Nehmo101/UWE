"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { AuthUiVariant } from "./AuthPageLayout";
import { AuthCard, AuthPageLayout, authClasses } from "./AuthPageLayout";

interface ResetPasswordFormProps {
  variant: AuthUiVariant;
}

function ResetPasswordFormInner({ variant }: ResetPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const emailFromUrl = searchParams.get("email") ?? "";
  const classes = authClasses(variant);

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
        token,
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
    <AuthCard
      variant={variant}
      title="Neues Passwort setzen"
      lead="Wähle ein sicheres Passwort mit mindestens 8 Zeichen."
      footer={<Link href="/login">← Zurück zur Anmeldung</Link>}
    >
      {!token ? (
        <p className={classes.error} role="alert">
          {error}
        </p>
      ) : (
        <form className={classes.form} onSubmit={handleSubmit}>
          {!emailFromUrl && (
            <>
              <label htmlFor="reset-email">E-Mail</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </>
          )}

          <label htmlFor="reset-password">Neues Passwort</label>
          <input
            id="reset-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />

          <label htmlFor="reset-password-confirm">Passwort bestätigen</label>
          <input
            id="reset-password-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />

          {error && (
            <p className={classes.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
            {loading ? "Speichere…" : "Passwort speichern"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm({ variant }: ResetPasswordFormProps) {
  const classes = authClasses(variant);

  return (
    <AuthPageLayout variant={variant}>
      <Suspense
        fallback={
          <section className={classes.card}>
            <p className={classes.lead}>Lade Formular…</p>
          </section>
        }
      >
        <ResetPasswordFormInner variant={variant} />
      </Suspense>
    </AuthPageLayout>
  );
}
