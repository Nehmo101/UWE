"use client";

import { useCallback, useState, type CSSProperties, type FormEvent } from "react";
import { TurnstileWidget } from "./TurnstileWidget";
import { readFormFieldValue, redirectAfterAuth } from "./auth-form-utils";
import { FONT_MONO, FONT_SERIF, LEADING, TEXT_2XL, TEXT_BASE, TEXT_SM, TEXT_XS, eyebrowStyle } from "./landing-shared";

export type LandingTarget = "studio" | "portal" | "brain" | "family";

export interface UweLandingLoginCardProps {
  target: LandingTarget;
  /** Absolute base URL of the target app (its own origin/subdomain). */
  appUrl: string;
  /** Cloudflare Turnstile site key — when set, a human check is required. */
  turnstileSiteKey?: string | null;
  /** Same-origin sign-in endpoint on the apex (Studio). */
  enterEndpoint?: string;
  onBack: () => void;
}

interface TargetCopy {
  accent: string;
  eyebrow: string;
  title: string;
  desc: string;
  submit: string;
  entryPath: string;
  passwordPath: string;
}

const TARGETS: Record<LandingTarget, TargetCopy> = {
  studio: {
    accent: "var(--uwe-accent)",
    eyebrow: "Für Spielleiter · Nur GM",
    title: "UWE Studio",
    desc: "Melde dich als GM an, um dein Kampagnen-Cockpit zu öffnen.",
    // Studios Einstieg ist seit Schritt 6 die Weltenliste; `/today` gibt es
    // nicht mehr (die Tagesübersicht liegt in Brain).
    entryPath: "/worlds",
    submit: "Als GM anmelden",
    passwordPath: "/account/password",
  },
  portal: {
    accent: "var(--uwe-player-visible)",
    eyebrow: "Für Spieler · Portal sichtbar",
    title: "UWE Portal",
    desc: "Melde dich an, um deine freigegebenen Welten zu öffnen.",
    submit: "Anmelden",
    entryPath: "/auth/worlds",
    passwordPath: "/auth/account/password",
  },
  brain: {
    accent: "#5c5470",
    eyebrow: "Nur Owner · privat & lokal",
    title: "UWE Brain",
    desc: "Melde dich als Owner an, um deinen privaten Alltags- und Wissensbereich zu öffnen.",
    submit: "Als Owner anmelden",
    entryPath: "/",
    passwordPath: "/account/password",
  },
  // Family braucht nur das Häkchen `Family` — keine Rolle, keine Welt.
  family: {
    accent: "#3f6b8c",
    eyebrow: "Für den Haushalt · lokal",
    title: "UWE Family",
    desc: "Melde dich an, um Verträge, Dokumente, Kalender und den gemeinsamen Chat zu öffnen.",
    submit: "Anmelden",
    entryPath: "/",
    passwordPath: "/account/password",
  },
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: TEXT_XS,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--uwe-fg-muted)",
};

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "9px",
  border: "1.5px solid var(--uwe-border)",
  background: "var(--uwe-input-bg)",
  color: "var(--uwe-fg)",
  fontFamily: FONT_MONO,
  fontSize: TEXT_BASE,
  outline: "none",
};

export function UweLandingLoginCard({
  target,
  appUrl,
  turnstileSiteKey,
  enterEndpoint = "/api/auth/enter",
  onBack,
}: UweLandingLoginCardProps) {
  const copy = TARGETS[target];
  const base = appUrl.replace(/\/$/, "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const turnstileEnabled = Boolean(turnstileSiteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRefresh, setTurnstileRefresh] = useState(0);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileRefresh((value) => value + 1);
  }, []);

  const handleResult = useCallback(
    (payload: {
      error?: string;
      requiresTwoFactor?: boolean;
      challengeToken?: string;
      forcePasswordChange?: boolean;
    }, ok: boolean): void => {
      if (!ok) {
        setError(payload.error ?? "Ungültige Anmeldedaten.");
        resetTurnstile();
        return;
      }
      if (payload.requiresTwoFactor && payload.challengeToken) {
        setChallengeToken(payload.challengeToken);
        setCode("");
        return;
      }
      // Full-page navigation to the target app's own origin — with SSO
      // (SESSION_COOKIE_DOMAIN) the just-set session carries across subdomains.
      redirectAfterAuth(base + (payload.forcePasswordChange ? copy.passwordPath : copy.entryPath));
    },
    [base, copy.entryPath, copy.passwordPath, resetTurnstile],
  );

  const postEnter = useCallback(
    async (body: Record<string, unknown>): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(enterEndpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, target }),
        });
        let payload: Parameters<typeof handleResult>[0];
        try {
          payload = (await response.json()) as typeof payload;
        } catch {
          setError("Unerwartete Server-Antwort. Bitte erneut versuchen.");
          return;
        }
        handleResult(payload, response.ok);
      } catch {
        setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
        resetTurnstile();
      } finally {
        setLoading(false);
      }
    },
    [enterEndpoint, target, handleResult, resetTurnstile],
  );

  const onSubmitCredentials = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (turnstileEnabled && !turnstileToken) {
        setError("Bitte bestätige zuerst, dass du ein Mensch bist.");
        return;
      }
      const form = event.currentTarget;
      const submittedEmail = readFormFieldValue(form, "email", email).trim();
      const submittedPassword = readFormFieldValue(form, "password", password);
      void postEnter({ email: submittedEmail, password: submittedPassword, turnstileToken });
    },
    [turnstileEnabled, turnstileToken, email, password, postEnter],
  );

  const onSubmitTwoFactor = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submittedCode = readFormFieldValue(form, "code", code).trim();
      void postEnter({ challengeToken, code: submittedCode });
    },
    [code, challengeToken, postEnter],
  );

  const cardStyle = {
    "--uwe-lp-accent": copy.accent,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "clamp(22px, 5vw, 32px)",
    borderRadius: "14px",
    background: "var(--uwe-card-bg)",
    border: "1.5px solid var(--uwe-border)",
    boxShadow: "0 1px 2px rgba(0,0,0,.22)",
  } as CSSProperties;

  const submitStyle: CSSProperties = {
    minHeight: "44px",
    borderRadius: "9px",
    border: "2px solid var(--uwe-fg)",
    background: copy.accent,
    color: "var(--uwe-on-accent)",
    fontFamily: FONT_MONO,
    fontSize: TEXT_SM,
    fontWeight: 700,
    cursor: "pointer",
  };

  const errorLine = error ? (
    <div
      role="alert"
      style={{
        fontSize: TEXT_SM,
        lineHeight: LEADING,
        color: "var(--uwe-danger)",
        borderTop: "1px solid var(--uwe-border)",
        paddingTop: "14px",
      }}
    >
      {error}
    </div>
  ) : null;

  return (
    <div
      className="uwe-lp-fade-login"
      style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <button
        type="button"
        onClick={onBack}
        className="uwe-lp-ghost uwe-lp-back"
        style={{
          alignSelf: "flex-start",
          minHeight: "44px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: FONT_MONO,
          fontSize: TEXT_SM,
          color: "var(--uwe-fg-muted)",
        }}
      >
        ← Zurück zur Auswahl
      </button>

      {challengeToken ? (
        <form onSubmit={onSubmitTwoFactor} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={eyebrowStyle(copy.accent)}>Zwei-Faktor</span>
            <span style={{ color: copy.accent }}>◆</span>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: TEXT_2XL, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--uwe-fg)" }}>
            {copy.title}
          </div>
          <p style={{ margin: 0, fontSize: TEXT_SM, lineHeight: LEADING, color: "var(--uwe-fg-muted)" }}>
            Gib den 6-stelligen Code aus deiner Authenticator-App ein.
          </p>
          <label style={labelStyle}>
            Authenticator-Code
            <input
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={8}
              autoFocus
              required
              className="uwe-lp-input"
              style={inputStyle}
            />
          </label>
          <button type="submit" className="uwe-lp-submit" style={submitStyle} disabled={loading}>
            {loading ? "Prüfe…" : "Bestätigen"}
          </button>
          {errorLine}
          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setError(null);
            }}
            className="uwe-lp-ghost uwe-lp-back"
            style={{
              alignSelf: "flex-start",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: FONT_MONO,
              fontSize: TEXT_SM,
              color: "var(--uwe-fg-muted)",
            }}
          >
            ← Anmeldedaten ändern
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitCredentials} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={eyebrowStyle(copy.accent)}>{copy.eyebrow}</span>
            <span style={{ color: copy.accent }}>◆</span>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: TEXT_2XL, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--uwe-fg)" }}>
            {copy.title}
          </div>
          <p style={{ margin: 0, fontSize: TEXT_SM, lineHeight: LEADING, color: "var(--uwe-fg-muted)" }}>{copy.desc}</p>

          <label style={labelStyle}>
            E-Mail
            <input
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="z. B. dm@uwe.local"
              autoFocus
              required
              className="uwe-lp-input"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Passwort
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="uwe-lp-input"
              style={inputStyle}
            />
          </label>

          {turnstileSiteKey ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              refreshSignal={turnstileRefresh}
              className="min-h-[65px]"
            />
          ) : null}

          <button
            type="submit"
            className="uwe-lp-submit"
            style={submitStyle}
            disabled={loading || (turnstileEnabled && !turnstileToken)}
          >
            {loading ? "Anmelden…" : copy.submit}
          </button>

          {errorLine}
        </form>
      )}
    </div>
  );
}
