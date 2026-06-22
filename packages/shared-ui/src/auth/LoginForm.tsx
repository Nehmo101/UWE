"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { AuthUiVariant } from "./AuthPageLayout";
import { readFormFieldValue, redirectAfterAuth } from "./auth-form-utils";
import { AuthCard, AuthPageLayout, authClasses } from "./AuthPageLayout";

const SHOW_DEV_CREDENTIALS = process.env.NODE_ENV === "development";

interface LoginFormProps {
  variant: AuthUiVariant;
  title: string;
  lead: string;
  defaultRedirect: string;
  forcePasswordRedirect: string;
  footer?: React.ReactNode;
  devCredentials?: React.ReactNode;
  devDefaultEmail?: string;
  devDefaultPassword?: string;
}

function LoginFormInner({
  variant,
  title,
  lead,
  defaultRedirect,
  forcePasswordRedirect,
  footer,
  devCredentials,
  devDefaultEmail,
  devDefaultPassword,
}: LoginFormProps) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? defaultRedirect;
  const forbidden = searchParams.get("error") === "forbidden";
  const resetSuccess = searchParams.get("reset") === "success";
  const classes = authClasses(variant);

  const [email, setEmail] = useState(
    SHOW_DEV_CREDENTIALS && devDefaultEmail ? devDefaultEmail : "",
  );
  const [password, setPassword] = useState(
    SHOW_DEV_CREDENTIALS && devDefaultPassword ? devDefaultPassword : "",
  );
  const [error, setError] = useState<string | null>(
    forbidden ? "Keine Berechtigung für diesen Bereich." : null,
  );
  const [loading, setLoading] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    challengeToken: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = event.currentTarget;
    const submittedEmail = readFormFieldValue(form, "email", email).trim();
    const submittedPassword = readFormFieldValue(form, "password", password);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      });

      let payload: {
        error?: string;
        forcePasswordChange?: boolean;
        requiresTwoFactor?: boolean;
        challengeToken?: string;
      };

      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        setError("Unerwartete Server-Antwort. Bitte erneut versuchen.");
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "Ungültige Anmeldedaten.");
        return;
      }

      if (payload.requiresTwoFactor && payload.challengeToken) {
        setTwoFactorChallenge({ challengeToken: payload.challengeToken });
        setTwoFactorCode("");
        return;
      }

      if (payload.forcePasswordChange) {
        redirectAfterAuth(forcePasswordRedirect);
        return;
      }

      redirectAfterAuth(redirectTo);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactorSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!twoFactorChallenge) return;

    setLoading(true);
    setError(null);

    const form = event.currentTarget;
    const submittedCode = readFormFieldValue(form, "code", twoFactorCode).trim();

    try {
      const response = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: twoFactorChallenge.challengeToken,
          code: submittedCode,
        }),
      });

      let payload: {
        error?: string;
        forcePasswordChange?: boolean;
      };

      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        setError("Unerwartete Server-Antwort. Bitte erneut versuchen.");
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "Ungültiger 2FA-Code.");
        return;
      }

      if (payload.forcePasswordChange) {
        redirectAfterAuth(forcePasswordRedirect);
        return;
      }

      redirectAfterAuth(redirectTo);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (twoFactorChallenge) {
    return (
      <AuthCard
        variant={variant}
        title="Zwei-Faktor-Authentifizierung"
        lead="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
        footer={footer}
      >
        <form className={classes.form} onSubmit={handleTwoFactorSubmit} noValidate={false}>
          <label htmlFor="login-2fa-code">Authenticator-Code</label>
          <input
            id="login-2fa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={8}
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
            required
            autoFocus
            aria-invalid={error ? true : undefined}
          />

          {error && (
            <p className={classes.error} role="alert">
              {error}
            </p>
          )}

          <div className="uwe-auth-form-actions">
            <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
              {loading ? "Prüfe…" : "Bestätigen"}
            </button>
            <button
              type="button"
              className="uwe-btn uwe-btn-ghost"
              disabled={loading}
              onClick={() => {
                setTwoFactorChallenge(null);
                setTwoFactorCode("");
                setError(null);
              }}
            >
              Zurück
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard variant={variant} title={title} lead={lead} footer={footer}>
      <form className={classes.form} onSubmit={handleSubmit} noValidate={false}>
        <label htmlFor="login-email">E-Mail</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          aria-invalid={error ? true : undefined}
        />

        <label htmlFor="login-password">Passwort</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          aria-invalid={error ? true : undefined}
        />

        {resetSuccess && (
          <p className={classes.success} role="status">
            Passwort wurde geändert. Du kannst dich jetzt anmelden.
          </p>
        )}

        {error && (
          <p className={classes.error} role="alert">
            {error}
          </p>
        )}

        <div className="uwe-auth-form-actions">
          <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
          <Link className={classes.link} href="/forgot-password">
            Passwort vergessen?
          </Link>
        </div>
      </form>

      {SHOW_DEV_CREDENTIALS && devCredentials}
    </AuthCard>
  );
}

export function LoginForm(props: LoginFormProps) {
  const classes = authClasses(props.variant);

  return (
    <AuthPageLayout variant={props.variant}>
      <Suspense
        fallback={
          <section className={classes.card}>
            <p className="uwe-auth-loading">Lade Anmeldung…</p>
          </section>
        }
      >
        <LoginFormInner {...props} />
      </Suspense>
    </AuthPageLayout>
  );
}
