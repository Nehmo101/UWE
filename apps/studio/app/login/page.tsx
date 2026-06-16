"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const SHOW_DEV_CREDENTIALS = process.env.NODE_ENV === "development";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const forbidden = searchParams.get("error") === "forbidden";

  const [email, setEmail] = useState(SHOW_DEV_CREDENTIALS ? "dm@uwe.local" : "");
  const [password, setPassword] = useState(SHOW_DEV_CREDENTIALS ? "uwe-dev" : "");
  const [error, setError] = useState<string | null>(
    forbidden ? "Keine Berechtigung für diesen Bereich." : null,
  );
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

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Ungültige Anmeldedaten.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <section className="studio-auth-card">
      <h1>UWE Studio — Anmeldung</h1>
      <p className="studio-auth-lead">
        Interne Schutzschicht für den Welten-Editor. Cloudflare Access bleibt die äußere Schutzschicht.
      </p>

      <form className="studio-auth-form" onSubmit={handleSubmit}>
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

        {error && <p className="studio-auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      {SHOW_DEV_CREDENTIALS && (
        <div className="studio-auth-seed-users">
          <h2>Entwicklungs-Benutzer</h2>
          <ul>
            <li>DM: dm@uwe.local / uwe-dev</li>
          </ul>
        </div>
      )}

      <p className="studio-auth-footer">
        <Link href="/setup">Erstes Setup</Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="studio-auth-page">
      <Suspense fallback={<section className="studio-auth-card">Lade Anmeldung…</section>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
