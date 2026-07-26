"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TurnstileWidget, isPasskeySupported, loginWithPasskey } from "@uwe/shared-ui";
import { readFormFieldValue, redirectAfterAuth } from "@/src/lib/auth-form-utils";
import { sanitizePortalRedirectPath } from "@/src/lib/portal-redirect";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PortalAuthShell } from "./PortalAuthShell";
import { LoadingState } from "@/src/components/ui/states";

const SHOW_DEV_CREDENTIALS = process.env.NODE_ENV === "development";

/** German copy for the `?error=google_*` codes set by the OAuth callback. */
const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_disabled: "Google-Login ist derzeit deaktiviert.",
  google_cancelled: "Google-Anmeldung abgebrochen.",
  google_failed: "Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
  google_unknown:
    "Diese Google-E-Mail ist keinem UWE-Konto zugeordnet. Bitte wende dich an deine Spielleitung.",
  google_no_access: "Dieses Konto hat keinen Zugriff auf diesen Bereich.",
};

interface PortalLoginFormProps {
  title?: string;
  lead?: string;
  defaultRedirect?: string;
  forcePasswordRedirect?: string;
  devDefaultEmail?: string;
  devDefaultPassword?: string;
  /** Cloudflare Turnstile site key — when set, a "Verify you are human" check is required. */
  turnstileSiteKey?: string | null;
  /** Whether passkey (WebAuthn) login is enabled in the system settings. */
  passkeysEnabled?: boolean;
  /** Whether "Mit Google anmelden" is enabled (toggle + credentials present). */
  googleLoginEnabled?: boolean;
  /** Absolute URL of the Studio-origin Google OAuth start endpoint. */
  googleStartUrl?: string;
}

function PortalLoginFormInner({
  title = "UWE Portal — Anmeldung",
  lead = "Melde dich an, um freigegebene Inhalte deiner Kampagne zu sehen.",
  defaultRedirect = "/auth/worlds",
  forcePasswordRedirect = "/auth/account/password",
  devDefaultEmail,
  devDefaultPassword,
  turnstileSiteKey,
  passkeysEnabled = false,
  googleLoginEnabled = false,
  googleStartUrl,
}: PortalLoginFormProps) {
  const searchParams = useSearchParams();
  const redirectTo = sanitizePortalRedirectPath(
    searchParams.get("redirect"),
    defaultRedirect,
  );
  const errorParam = searchParams.get("error");
  const forbidden = errorParam === "forbidden";
  const resetSuccess = searchParams.get("reset") === "success";
  // Optional prefill forwarded from the uweanddragons.org landing page.
  const prefillEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(
    prefillEmail || (SHOW_DEV_CREDENTIALS && devDefaultEmail ? devDefaultEmail : ""),
  );
  const [password, setPassword] = useState(
    SHOW_DEV_CREDENTIALS && devDefaultPassword ? devDefaultPassword : "",
  );
  const [error, setError] = useState<string | null>(
    forbidden
      ? "Keine Berechtigung für diesen Bereich."
      : (errorParam && GOOGLE_ERROR_MESSAGES[errorParam]) || null,
  );
  const [loading, setLoading] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    challengeToken: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const turnstileEnabled = Boolean(turnstileSiteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRefresh, setTurnstileRefresh] = useState(0);
  // SSR-safe: only show the passkey button once the browser confirmed support.
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  useEffect(() => {
    if (passkeysEnabled) {
      setPasskeyAvailable(isPasskeySupported());
    }
  }, [passkeysEnabled]);

  // Google logins with 2FA hand their challenge token over via the URL
  // fragment (never logged server-side) — pick it up and enter the code step.
  useEffect(() => {
    const match = window.location.hash.match(/googleChallenge=([^&]+)/);
    if (match?.[1]) {
      setTwoFactorChallenge({ challengeToken: decodeURIComponent(match[1]) });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  async function handlePasskeyLogin() {
    setLoading(true);
    setError(null);

    try {
      const result = await loginWithPasskey();
      if (!result.ok) {
        if (!result.cancelled) {
          setError(result.error ?? "Passkey-Anmeldung fehlgeschlagen.");
        }
        return;
      }

      if (result.forcePasswordChange) {
        redirectAfterAuth(forcePasswordRedirect);
        return;
      }

      redirectAfterAuth(redirectTo);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (turnstileEnabled && !turnstileToken) {
      setError("Bitte bestätige zuerst, dass du ein Mensch bist.");
      return;
    }

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
        body: JSON.stringify({
          email: submittedEmail,
          password: submittedPassword,
          turnstileToken,
        }),
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
        // Turnstile tokens are single-use — force a fresh challenge for the retry.
        setTurnstileToken(null);
        setTurnstileRefresh((value) => value + 1);
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
      setTurnstileToken(null);
      setTurnstileRefresh((value) => value + 1);
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

      let payload: { error?: string; forcePasswordChange?: boolean };

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
      <PortalAuthShell
        title="Zwei-Faktor-Authentifizierung"
        description="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
        footer={<Link href="/">← Zurück zur Startseite</Link>}
      >
        <form className="space-y-4" onSubmit={handleTwoFactorSubmit}>
          <div className="space-y-2">
            <Label htmlFor="login-2fa-code">Authenticator-Code</Label>
            <Input
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
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Prüfe…" : "Bestätigen"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setTwoFactorChallenge(null);
                setTwoFactorCode("");
                setError(null);
              }}
            >
              Zurück
            </Button>
          </div>
        </form>
      </PortalAuthShell>
    );
  }

  return (
    <PortalAuthShell
      title={title}
      description={lead}
      footer={<Link href="/">← Zurück zur Startseite</Link>}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-email">E-Mail</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="login-password">Passwort</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Passwort vergessen?
            </Link>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
          />
        </div>

        {turnstileSiteKey ? (
          <div className="space-y-2">
            <Label htmlFor="login-turnstile">Sicherheitsprüfung</Label>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              refreshSignal={turnstileRefresh}
              className="min-h-[65px]"
            />
            <p className="text-xs text-muted-foreground">
              Cloudflare bestätigt, dass du ein Mensch bist, bevor du UWE betrittst.
            </p>
          </div>
        ) : null}

        {resetSuccess ? (
          <Alert tone="success">Passwort wurde geändert. Du kannst dich jetzt anmelden.</Alert>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={loading || (turnstileEnabled && !turnstileToken)}>
            {loading ? "Anmelden…" : "Anmelden"}
          </Button>
          {passkeyAvailable ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handlePasskeyLogin}
            >
              Mit Passkey anmelden
            </Button>
          ) : null}
          {googleLoginEnabled && googleStartUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                window.location.assign(googleStartUrl);
              }}
            >
              Mit Google anmelden
            </Button>
          ) : null}
        </div>
      </form>

      {SHOW_DEV_CREDENTIALS ? (
        <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Entwicklungs-Benutzer</p>
          <p className="text-muted-foreground">
            Spieler: aman@uwe.local, lazul@uwe.local, veldrin@uwe.local, finnion@uwe.local / uwe-dev
          </p>
        </div>
      ) : null}
    </PortalAuthShell>
  );
}

export function PortalLoginForm(props: PortalLoginFormProps) {
  return (
    <Suspense fallback={<LoadingState title="Lade Anmeldung…" />}>
      <PortalLoginFormInner {...props} />
    </Suspense>
  );
}
