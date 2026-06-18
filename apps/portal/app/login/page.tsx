"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const SHOW_DEV_CREDENTIALS = process.env.NODE_ENV === "development";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/auth/worlds";

  const [email, setEmail] = useState(SHOW_DEV_CREDENTIALS ? "aman@uwe.local" : "");
  const [password, setPassword] = useState(SHOW_DEV_CREDENTIALS ? "uwe-dev" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    const payload = (await response.json()) as {
      error?: string;
      forcePasswordChange?: boolean;
    };

    if (!response.ok) {
      setError(payload.error ?? "Anmeldung fehlgeschlagen.");
      return;
    }

    if (payload.forcePasswordChange) {
      router.push("/auth/account/password");
      router.refresh();
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <section className="auth-card">
      <h1>UWE Portal — Anmeldung</h1>
      <p className="auth-lead">
        Melde dich an, um freigegebene Inhalte deiner Kampagne zu sehen.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">E-Mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Passwort</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      {SHOW_DEV_CREDENTIALS && (
        <div className="auth-seed-users">
          <h2>Entwicklungs-Benutzer</h2>
          <ul>
            <li>DM: dm@uwe.local / uwe-dev</li>
            <li>Spieler: aman@uwe.local, lazul@uwe.local, veldrin@uwe.local, finnion@uwe.local / uwe-dev</li>
          </ul>
        </div>
      )}

      <p className="auth-footer">
        <Link href="/forgot-password">Passwort vergessen?</Link>
        {" · "}
        <Link href="/">← Zurück zum Portal</Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={<section className="auth-card">Lade Anmeldung…</section>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
